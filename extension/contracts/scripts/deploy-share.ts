import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Deploying SmartDocumentShare (UUPS Proxy)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy SmartDocumentShare via UUPS proxy
  console.log("Deploying SmartDocumentShare proxy + implementation...");
  const SmartDocumentShare = await ethers.getContractFactory("SmartDocumentShare");
  const share = await upgrades.deployProxy(SmartDocumentShare, [], {
    kind: "uups",
    initializer: "initialize",
  });
  await share.waitForDeployment();

  const proxyAddress = await share.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Proxy deployed to:", proxyAddress);
  console.log("Implementation deployed to:", implementationAddress);

  console.log("\n--- Deployment Complete ---");
  console.log("Proxy (use this address):", proxyAddress);
  console.log("Implementation:", implementationAddress);
  console.log("\nNext steps:");
  console.log("1. Update extension/src/constants/smartDocumentShare.ts with the proxy address above");
  console.log("2. Verify implementation: npm run verify --", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
