"""
Bridge Relayer Service

Watches for TokensLocked events on source chains and releases ETH on target chains.
Run this as a background process or cron job.

Usage:
    python -m app.services.bridge_relayer

Environment variables needed:
    RELAYER_PRIVATE_KEY - Private key for the relayer wallet
    SEPOLIA_RPC_URL - RPC URL for Sepolia
    BASE_SEPOLIA_RPC_URL - RPC URL for Base Sepolia
"""

import os
import time
import logging
from typing import Optional
from dataclasses import dataclass
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from dotenv import load_dotenv

load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Chain configurations
@dataclass
class ChainConfig:
    chain_id: int
    name: str
    rpc_url: str
    bridge_source_address: str
    bridge_target_address: str


# Chain configs - update addresses after deployment
CHAINS = {
    11155111: ChainConfig(
        chain_id=11155111,
        name="Sepolia",
        rpc_url=os.getenv("SEPOLIA_RPC_URL", "https://rpc.sepolia.org"),
        bridge_source_address="",  # TODO: Add after deployment
        bridge_target_address="",  # TODO: Add after deployment
    ),
    84532: ChainConfig(
        chain_id=84532,
        name="Base Sepolia",
        rpc_url=os.getenv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org"),
        bridge_source_address="",  # TODO: Add after deployment
        bridge_target_address="",  # TODO: Add after deployment
    ),
}

# Chain pairs (source chain ID -> target chain ID)
CHAIN_PAIRS = {
    11155111: 84532,  # Sepolia -> Base Sepolia
    84532: 11155111,  # Base Sepolia -> Sepolia
}

# Contract ABIs (minimal)
BRIDGE_SOURCE_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "nonce", "type": "uint256"},
            {"indexed": True, "name": "sender", "type": "address"},
            {"indexed": False, "name": "amount", "type": "uint256"},
            {"indexed": False, "name": "targetChainId", "type": "uint256"},
            {"indexed": False, "name": "timestamp", "type": "uint256"}
        ],
        "name": "TokensLocked",
        "type": "event"
    },
    {
        "inputs": [{"name": "nonce", "type": "uint256"}],
        "name": "getLock",
        "outputs": [
            {
                "components": [
                    {"name": "sender", "type": "address"},
                    {"name": "amount", "type": "uint256"},
                    {"name": "targetChainId", "type": "uint256"},
                    {"name": "timestamp", "type": "uint256"},
                    {"name": "processed", "type": "bool"}
                ],
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"name": "nonce", "type": "uint256"}],
        "name": "markProcessed",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

BRIDGE_TARGET_ABI = [
    {
        "inputs": [
            {"name": "recipient", "type": "address"},
            {"name": "amount", "type": "uint256"},
            {"name": "sourceChainId", "type": "uint256"},
            {"name": "sourceNonce", "type": "uint256"}
        ],
        "name": "release",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "sourceChainId", "type": "uint256"},
            {"name": "sourceNonce", "type": "uint256"},
            {"name": "recipient", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "name": "isProcessed",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
]


class BridgeRelayer:
    """Relayer that processes bridge transactions."""

    def __init__(self):
        self.private_key = os.getenv("RELAYER_PRIVATE_KEY")
        if not self.private_key:
            raise ValueError("RELAYER_PRIVATE_KEY not set")

        # Initialize Web3 connections
        self.web3_connections: dict[int, Web3] = {}
        self.source_contracts: dict[int, any] = {}
        self.target_contracts: dict[int, any] = {}

        for chain_id, config in CHAINS.items():
            web3 = Web3(Web3.HTTPProvider(config.rpc_url))

            # Add middleware for PoA chains like Base
            web3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

            self.web3_connections[chain_id] = web3

            if config.bridge_source_address:
                self.source_contracts[chain_id] = web3.eth.contract(
                    address=Web3.to_checksum_address(config.bridge_source_address),
                    abi=BRIDGE_SOURCE_ABI
                )

            if config.bridge_target_address:
                self.target_contracts[chain_id] = web3.eth.contract(
                    address=Web3.to_checksum_address(config.bridge_target_address),
                    abi=BRIDGE_TARGET_ABI
                )

        # Get relayer address
        account = self.web3_connections[11155111].eth.account.from_key(self.private_key)
        self.relayer_address = account.address
        logger.info(f"Relayer address: {self.relayer_address}")

    def get_unprocessed_locks(self, source_chain_id: int, from_block: int) -> list:
        """Get all unprocessed lock events from a source chain."""
        if source_chain_id not in self.source_contracts:
            return []

        web3 = self.web3_connections[source_chain_id]
        contract = self.source_contracts[source_chain_id]

        try:
            # Get latest block
            latest_block = web3.eth.block_number

            # Get TokensLocked events
            events = contract.events.TokensLocked.get_logs(
                from_block=from_block,
                to_block=latest_block
            )

            unprocessed = []
            for event in events:
                nonce = event.args.nonce
                lock_info = contract.functions.getLock(nonce).call()

                if not lock_info[4]:  # processed = False
                    unprocessed.append({
                        "nonce": nonce,
                        "sender": lock_info[0],
                        "amount": lock_info[1],
                        "target_chain_id": lock_info[2],
                        "timestamp": lock_info[3],
                        "source_chain_id": source_chain_id,
                        "tx_hash": event.transactionHash.hex()
                    })

            return unprocessed

        except Exception as e:
            logger.error(f"Error getting locks from chain {source_chain_id}: {e}")
            return []

    def release_on_target(
        self,
        target_chain_id: int,
        recipient: str,
        amount: int,
        source_chain_id: int,
        source_nonce: int
    ) -> Optional[str]:
        """Release ETH on target chain."""
        if target_chain_id not in self.target_contracts:
            logger.error(f"No target contract for chain {target_chain_id}")
            return None

        web3 = self.web3_connections[target_chain_id]
        contract = self.target_contracts[target_chain_id]

        try:
            # Check if already processed
            is_processed = contract.functions.isProcessed(
                source_chain_id,
                source_nonce,
                Web3.to_checksum_address(recipient),
                amount
            ).call()

            if is_processed:
                logger.info(f"Already processed: {source_chain_id}:{source_nonce}")
                return None

            # Build release transaction
            account = web3.eth.account.from_key(self.private_key)
            nonce = web3.eth.get_transaction_count(account.address)

            tx = contract.functions.release(
                Web3.to_checksum_address(recipient),
                amount,
                source_chain_id,
                source_nonce
            ).build_transaction({
                "from": account.address,
                "nonce": nonce,
                "gas": 100000,
                "gasPrice": web3.eth.gas_price,
            })

            # Sign and send
            signed = web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)

            logger.info(f"Release tx sent: {tx_hash.hex()}")

            # Wait for confirmation
            receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt.status == 1:
                logger.info(f"Release confirmed: {tx_hash.hex()}")
                return tx_hash.hex()
            else:
                logger.error(f"Release failed: {tx_hash.hex()}")
                return None

        except Exception as e:
            logger.error(f"Error releasing on chain {target_chain_id}: {e}")
            return None

    def mark_as_processed(self, source_chain_id: int, nonce: int) -> bool:
        """Mark a lock as processed on source chain."""
        if source_chain_id not in self.source_contracts:
            return False

        web3 = self.web3_connections[source_chain_id]
        contract = self.source_contracts[source_chain_id]

        try:
            account = web3.eth.account.from_key(self.private_key)
            tx_nonce = web3.eth.get_transaction_count(account.address)

            tx = contract.functions.markProcessed(nonce).build_transaction({
                "from": account.address,
                "nonce": tx_nonce,
                "gas": 50000,
                "gasPrice": web3.eth.gas_price,
            })

            signed = web3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)

            receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            return receipt.status == 1

        except Exception as e:
            logger.error(f"Error marking processed on chain {source_chain_id}: {e}")
            return False

    def process_pending_bridges(self, from_block: int = 0):
        """Process all pending bridges from all chains."""
        for source_chain_id in CHAINS.keys():
            target_chain_id = CHAIN_PAIRS.get(source_chain_id)
            if not target_chain_id:
                continue

            chain_name = CHAINS[source_chain_id].name
            logger.info(f"Checking {chain_name} for pending locks...")

            locks = self.get_unprocessed_locks(source_chain_id, from_block)

            if not locks:
                logger.info(f"No pending locks on {chain_name}")
                continue

            logger.info(f"Found {len(locks)} pending locks on {chain_name}")

            for lock in locks:
                logger.info(f"Processing lock {lock['nonce']} from {chain_name}")
                logger.info(f"  Recipient: {lock['sender']}")
                logger.info(f"  Amount: {Web3.from_wei(lock['amount'], 'ether')} ETH")

                # Release on target chain
                release_tx = self.release_on_target(
                    target_chain_id=lock["target_chain_id"],
                    recipient=lock["sender"],
                    amount=lock["amount"],
                    source_chain_id=source_chain_id,
                    source_nonce=lock["nonce"]
                )

                if release_tx:
                    # Mark as processed on source
                    self.mark_as_processed(source_chain_id, lock["nonce"])
                    logger.info(f"Processed lock {lock['nonce']} successfully")
                else:
                    logger.error(f"Failed to process lock {lock['nonce']}")

    def run(self, interval: int = 30):
        """Run the relayer continuously."""
        logger.info("Starting bridge relayer...")

        # Start from recent blocks (last ~1000 blocks)
        from_blocks = {}
        for chain_id in CHAINS.keys():
            web3 = self.web3_connections[chain_id]
            try:
                latest = web3.eth.block_number
                from_blocks[chain_id] = max(0, latest - 1000)
            except Exception:
                from_blocks[chain_id] = 0

        while True:
            try:
                self.process_pending_bridges(
                    from_block=min(from_blocks.values()) if from_blocks else 0
                )

                # Update from_blocks to current
                for chain_id in CHAINS.keys():
                    web3 = self.web3_connections[chain_id]
                    try:
                        from_blocks[chain_id] = web3.eth.block_number
                    except Exception:
                        pass

            except Exception as e:
                logger.error(f"Error in relayer loop: {e}")

            logger.info(f"Sleeping for {interval} seconds...")
            time.sleep(interval)


def main():
    """Run the bridge relayer."""
    # Check if contracts are configured
    has_contracts = any(
        config.bridge_source_address and config.bridge_target_address
        for config in CHAINS.values()
    )

    if not has_contracts:
        logger.warning("No bridge contracts configured!")
        logger.warning("Deploy contracts first and update addresses in this file.")
        logger.warning("\nTo deploy contracts:")
        logger.warning("  cd dapp/contracts")
        logger.warning("  npm install")
        logger.warning("  cp .env.example .env  # and add your private key")
        logger.warning("  npm run deploy:sepolia")
        logger.warning("  npm run deploy:base-sepolia")
        return

    relayer = BridgeRelayer()
    relayer.run(interval=30)


if __name__ == "__main__":
    main()
