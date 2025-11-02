// import { HardhatRuntimeEnvironment } from "hardhat/types";
// import { DeployFunction } from "hardhat-deploy/types";
// import { Contract } from "ethers";

// /**
//  * Deploys a contract named "YourContract" using the deployer account and
//  * constructor arguments set to the deployer address
//  *
//  * @param hre HardhatRuntimeEnvironment object.
//  */
// const deployYourContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
//   /*
//     On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

//     When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
//     should have sufficient balance to pay for the gas fees for contract creation.

//     You can generate a random account with `yarn generate` or `yarn account:import` to import your
//     existing PK which will fill DEPLOYER_PRIVATE_KEY_ENCRYPTED in the .env file (then used on hardhat.config.ts)
//     You can run the `yarn account` command to check your balance in every network.
//   */
//   const { deployer } = await hre.getNamedAccounts();
//   const { deploy } = hre.deployments;

//   await deploy("YourContract", {
//     from: deployer,
//     // Contract constructor arguments
//     args: [deployer],
//     log: true,
//     // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
//     // automatically mining the contract deployment transaction. There is no effect on live networks.
//     autoMine: true,
//   });

//   // Get the deployed contract to interact with it after deploying.
//   const yourContract = await hre.ethers.getContract<Contract>("YourContract", deployer);
//   console.log("👋 Initial greeting:", await yourContract.greeting());
// };

// export default deployYourContract;

// // Tags are useful if you have multiple deploy files and only want to run one of them.
// // e.g. yarn deploy --tags YourContract
// deployYourContract.tags = ["YourContract"];

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
