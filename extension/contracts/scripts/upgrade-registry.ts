import { ethers, upgrades } from "hardhat";

async function main() {
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;

  if (!PROXY_ADDRESS) {
    throw new Error("PROXY_ADDRESS environment variable is required");
  }

  console.log("Upgrading AddressRegistry...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Upgrader:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  console.log("Proxy address:", PROXY_ADDRESS);
  console.log("Deploying new implementation...");

  const AddressRegistry = await ethers.getContractFactory("AddressRegistry");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, AddressRegistry);
  await upgraded.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);

  console.log("\n--- Upgrade Complete ---");
  console.log("Proxy (unchanged):", PROXY_ADDRESS);
  console.log("New implementation:", newImplementation);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
