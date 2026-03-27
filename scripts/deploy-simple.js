const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Starting EasyDEX Basic deployment...");
    
    const [deployer] = await ethers.getSigners();
    
    console.log("💼 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
    
    // Deploy SimplePriceHelper (Oracle)
    console.log("\n📊 Deploying SimplePriceHelper...");
    const SimplePriceHelper = await ethers.getContractFactory("SimplePriceHelper");
    const priceHelper = await SimplePriceHelper.deploy();
    await priceHelper.waitForDeployment();
    const priceHelperAddr = await priceHelper.getAddress();
    console.log("✅ SimplePriceHelper deployed to:", priceHelperAddr);
    
    // Deploy ELF Token (Liquidity Receipt Token)
    console.log("\n🧝 Deploying ELF Token...");
    const ELFToken = await ethers.getContractFactory("ELFToken");
    const elfToken = await ELFToken.deploy();
    await elfToken.waitForDeployment();
    const elfTokenAddr = await elfToken.getAddress();
    console.log("✅ ELF Token deployed to:", elfTokenAddr);
    
    // Deploy EASY Token (Governance Token)
    console.log("\n💎 Deploying EASY Token...");
    const EasyToken = await ethers.getContractFactory("EasyToken");
    const easyToken = await EasyToken.deploy(0); // Pass default settings
    await easyToken.waitForDeployment();
    const easyTokenAddr = await easyToken.getAddress();
    console.log("✅ EASY Token deployed to:", easyTokenAddr);
    
    // Deploy PoolManager
    console.log("\n🎛️ Deploying PoolManager...");
    const PoolManager = await ethers.getContractFactory("PoolManager");
    const poolManager = await PoolManager.deploy(priceHelperAddr, elfTokenAddr, easyTokenAddr);
    await poolManager.waitForDeployment();
    const poolManagerAddr = await poolManager.getAddress();
    console.log("✅ PoolManager deployed to:", poolManagerAddr);
    
    // Set PoolManager in EasyToken and transfer ownership
    console.log("\n🔄 Setting up token permissions...");
    await easyToken.setPoolManager(poolManagerAddr);
    await elfToken.transferOwnership(poolManagerAddr);
    await easyToken.transferOwnership(poolManagerAddr);
    console.log("✅ Token permissions configured");
    
    // Deploy test tokens for demo
    console.log("\n🪙 Deploying test tokens...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    const tokenA = await MockERC20.deploy("Test Token A", "TKA", 18);
    await tokenA.waitForDeployment();
    const tokenAAddr = await tokenA.getAddress();
    console.log("✅ Test Token A deployed to:", tokenAAddr);
    
    const tokenB = await MockERC20.deploy("Test Token B", "TKB", 18);
    await tokenB.waitForDeployment();
    const tokenBAddr = await tokenB.getAddress();
    console.log("✅ Test Token B deployed to:", tokenBAddr);
    
    const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    const usdcAddr = await usdc.getAddress();
    console.log("✅ Mock USDC deployed to:", usdcAddr);
    
    // Mint initial tokens to deployer for testing
    console.log("\n🎯 Minting test tokens...");
    await tokenA.mint(deployer.address, ethers.parseEther("1000000"));
    await tokenB.mint(deployer.address, ethers.parseEther("1000000"));
    await usdc.mint(deployer.address, ethers.parseUnits("1000000", 6));
    console.log("✅ Test tokens minted");
    
    // Set mock prices in price helper
    console.log("\n💰 Setting up mock prices...");
    await priceHelper.setMockPrice(tokenAAddr, 1 * 10**8, 8); // $1.00
    await priceHelper.setMockPrice(tokenBAddr, 2 * 10**8, 8); // $2.00
    await priceHelper.setMockPrice(usdcAddr, 1 * 10**8, 8);   // $1.00
    console.log("✅ Mock prices set");
    
    // Deploy Governance contract
    console.log("\n🏛️ Deploying Governance...");
    const Governance = await ethers.getContractFactory("Governance");
    const governance = await Governance.deploy(easyTokenAddr);
    await governance.waitForDeployment();
    const governanceAddr = await governance.getAddress();
    console.log("✅ Governance deployed to:", governanceAddr);
    
    // Save deployment addresses
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            PriceHelper: priceHelperAddr,
            ELFToken: elfTokenAddr,
            EasyToken: easyTokenAddr,
            PoolManager: poolManagerAddr,
            Governance: governanceAddr,
            TestTokens: {
                TokenA: tokenAAddr,
                TokenB: tokenBAddr,
                USDC: usdcAddr
            }
        },
        testPrices: {
            "TKA": "$1.00",
            "TKB": "$2.00", 
            "USDC": "$1.00"
        }
    };
    
    console.log("\n📋 Deployment Summary:");
    console.log("====================");
    console.log("🌐 Network:", deploymentInfo.network);
    console.log("👤 Deployer:", deploymentInfo.deployer);
    console.log("📅 Timestamp:", deploymentInfo.timestamp);
    console.log("\n📍 Contract Addresses:");
    console.log("├─ 📊 PriceHelper:", deploymentInfo.contracts.PriceHelper);
    console.log("├─ 🧝 ELF Token:", deploymentInfo.contracts.ELFToken);
    console.log("├─ 💎 EASY Token:", deploymentInfo.contracts.EasyToken);
    console.log("├─ 🎛️ PoolManager:", deploymentInfo.contracts.PoolManager);
    console.log("├─ 🏛️ Governance:", deploymentInfo.contracts.Governance);
    console.log("└─ 🪙 Test Tokens:");
    console.log("   ├─ TKA:", deploymentInfo.contracts.TestTokens.TokenA);
    console.log("   ├─ TKB:", deploymentInfo.contracts.TestTokens.TokenB);
    console.log("   └─ USDC:", deploymentInfo.contracts.TestTokens.USDC);
    
    // Save to file
    const fs = require('fs');
    if (!fs.existsSync('deployments')) {
        fs.mkdirSync('deployments');
    }
    fs.writeFileSync(
        `deployments/${hre.network.name}.json`,
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log(`\n💾 Deployment info saved to deployments/${hre.network.name}.json`);
    
    console.log("\n✨ EasyDEX basic deployment completed successfully! ✨");
    console.log("\n🎯 Ready for frontend development and demo!");
    console.log("📱 Use the contract addresses above to interact with the DEX");
    
    return deploymentInfo;
}

main()
    .then((deployment) => {
        console.log("\n🎉 Deployment successful!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });