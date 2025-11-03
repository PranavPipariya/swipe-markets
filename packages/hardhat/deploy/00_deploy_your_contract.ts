import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys "YourContract"
 * BUT: we override the constructor arg so that YOU are the owner,
 * not the hardhat deployer account.
 */
const deployYourContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // 🔒 <-- PUT YOUR WALLET ADDRESS HERE
  // This is the address that will be stored in `owner` in YourContract.
  const MY_ADDR = "0x0e66aB09998398A0e99dD2DE9C20FeF8cf8bf06c";
  await deploy("YourContract", {
    from: deployer, // this address actually broadcasts the tx
    args: [MY_ADDR], // BUT this is what becomes `owner` in constructor(address _owner)
    log: true,
    autoMine: true,
  });

  // Just reading the contract after deploy so we keep the console.log
  const yourContract = await hre.ethers.getContract<Contract>("YourContract", deployer);

  console.log("👋 Initial greeting:", await yourContract.greeting());
  console.log("🤖 Deployer account:", deployer);
  console.log("👑 Hardcoded owner SHOULD be:", MY_ADDR);
};

export default deployYourContract;

deployYourContract.tags = ["YourContract"];
