require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version:"0.8.17",
    settings:{
      optimizer: {
        enabled:true,
        runs:800,
      },
      viaIR:true,
    }
  }
};
