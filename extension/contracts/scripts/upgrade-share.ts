import { ethers, upgrades } from "hardhat";

// Update this with the deployed proxy address
const PROXY_ADDRESS = "0x0000000000000000000000000000000000000000";

async function main() {
  if (PROXY_ADDRESS === "0x0000000000000000000000000000000000000000") {
    throw new Error("Please set PROXY_ADDRESS to the deployed proxy address before upgrading");
  }

  console.log("Upgrading SmartDocumentShare...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  console.log("Proxy address:", PROXY_ADDRESS);

  const SmartDocumentShareV2 = await ethers.getContractFactory("SmartDocumentShare");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, SmartDocumentShareV2);
  await upgraded.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New implementation deployed to:", newImplementation);
  console.log("\n--- Upgrade Complete ---");
  console.log("Verify implementation: npm run verify --", newImplementation);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
