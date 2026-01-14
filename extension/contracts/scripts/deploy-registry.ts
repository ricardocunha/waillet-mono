import { ethers } from "hardhat";

async function main() {
  console.log("Deploying AddressRegistry...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy AddressRegistry
  console.log("Deploying AddressRegistry contract...");
  const AddressRegistry = await ethers.getContractFactory("AddressRegistry");
  const registry = await AddressRegistry.deploy();
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log("AddressRegistry deployed to:", registryAddress);

  // Get deployment transaction receipt for gas used
  const deployTx = registry.deploymentTransaction();
  if (deployTx) {
    const receipt = await deployTx.wait();
    if (receipt) {
      console.log("Gas used:", receipt.gasUsed.toString());
    }
  }

  console.log("\n--- Deployment Complete ---");
  console.log("AddressRegistry:", registryAddress);
  console.log("\nNext steps:");
  console.log("1. Update extension/src/constants/registry.ts with the address above");
  console.log("2. Verify contract: npm run verify --", registryAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
