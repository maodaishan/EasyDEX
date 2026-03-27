const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Starting EasyDEX deployment...");
    
    const [deployer] = await ethers.getSigners();
    
    console.log("💼 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
    
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
    
    // Deploy Main Pool
    console.log("\n🏊 Deploying Main Pool...");
    const Pool = await ethers.getContractFactory("Pool");
    const pool = await Pool.deploy(poolManagerAddr, priceHelperAddr);
    await pool.waitForDeployment();
    const poolAddr = await pool.getAddress();
    console.log("✅ Main Pool deployed to:", poolAddr);
    
    // Register pools for tokens in manager
    console.log("\n📝 Registering pools in manager...");
    // Note: addPool creates pools internally, so we skip this step for now
    console.log("✅ Pool registration skipped (pools will be created when needed)");
    
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
    
    // Add initial liquidity
    console.log("\n💧 Adding initial liquidity...");
    
    // Approve tokens
    await tokenA.approve(poolAddr, ethers.parseEther("100000"));
    await tokenB.approve(poolAddr, ethers.parseEther("200000"));
    await usdc.approve(poolAddr, ethers.parseUnits("100000", 6));
    
    // Add TKA/TKB liquidity
    console.log("Adding TKA/TKB liquidity...");
    await pool.addLiquidity(
        tokenAAddr,
        tokenBAddr,
        ethers.parseEther("50000"),      // 50,000 TKA
        ethers.parseEther("100000"),     // 100,000 TKB (1:2 ratio)
        ethers.parseEther("49000"),      // Min TKA
        ethers.parseEther("98000")       // Min TKB
    );
    
    // Add TKA/USDC liquidity
    console.log("Adding TKA/USDC liquidity...");
    await pool.addLiquidity(
        tokenAAddr,
        usdcAddr,
        ethers.parseEther("25000"),      // 25,000 TKA
        ethers.parseUnits("50000", 6),   // 50,000 USDC (1:2 ratio in USD)
        ethers.parseEther("24500"),      // Min TKA
        ethers.parseUnits("49000", 6)    // Min USDC
    );
    
    console.log("✅ Initial liquidity added");
    
    // Deploy Governance contract
    console.log("\n🏛️ Deploying Governance...");
    const Governance = await ethers.getContractFactory("Governance");
    const governance = await Governance.deploy(easyTokenAddr);
    await governance.waitForDeployment();
    const governanceAddr = await governance.getAddress();
    console.log("✅ Governance deployed to:", governanceAddr);
    
    // Verify deployment
    console.log("\n🔍 Verifying deployment...");
    const poolCount = await poolManager.getPoolCount();
    const isValidPool = await poolManager.isValidPool(poolAddr);
    const elfBalance = await elfToken.balanceOf(deployer.address);
    
    console.log("📊 Pool count:", poolCount.toString());
    console.log("✅ Is valid pool:", isValidPool);
    console.log("🧝 ELF balance:", ethers.formatEther(elfBalance));
    
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
            MainPool: poolAddr,
            Governance: governanceAddr,
            TestTokens: {
                TokenA: tokenAAddr,
                TokenB: tokenBAddr,
                USDC: usdcAddr
            }
        },
        initialLiquidity: {
            "TKA/TKB": "50,000 / 100,000",
            "TKA/USDC": "25,000 / 50,000"
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
    console.log("├─ 🏊 Main Pool:", deploymentInfo.contracts.MainPool);
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
    
    console.log("\n✨ EasyDEX deployment completed successfully! ✨");
    console.log("\n🎯 Next steps:");
    console.log("1. Create frontend interface");
    console.log("2. Test swaps and liquidity operations");
    console.log("3. Record demo video for Friday meeting");
    
    return deploymentInfo;
}

// Handle deployment errors
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