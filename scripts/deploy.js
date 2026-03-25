const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Deploy ELF Token first
    console.log("\n1. Deploying ELF Token...");
    const ELFToken = await hre.ethers.getContractFactory("ELFToken");
    const elfToken = await ELFToken.deploy();
    await elfToken.deployed();
    console.log("ELF Token deployed to:", elfToken.address);

    // Deploy EASY Token
    console.log("\n2. Deploying EASY Token...");
    const EasyToken = await hre.ethers.getContractFactory("EasyToken");
    const easyToken = await EasyToken.deploy();
    await easyToken.deployed();
    console.log("EASY Token deployed to:", easyToken.address);

    // Deploy PoolManager
    console.log("\n3. Deploying PoolManager...");
    const PoolManager = await hre.ethers.getContractFactory("PoolManager");
    
    // For testnet, we'll use a mock oracle address
    // For mainnet, use the actual Chainlink Feed Registry
    const oracleAddress = process.env.ORACLE_ADDRESS || "0x0000000000000000000000000000000000000000";
    
    const poolManager = await PoolManager.deploy(oracleAddress, elfToken.address, easyToken.address);
    await poolManager.deployed();
    console.log("PoolManager deployed to:", poolManager.address);

    // Set PoolManager in ELF Token
    console.log("\n4. Setting up ELF Token...");
    await elfToken.setPoolManager(poolManager.address);
    console.log("ELF Token manager set to:", poolManager.address);

    // Deploy mock tokens for testing
    console.log("\n5. Deploying mock tokens for testing...");
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    
    const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6); // 6 decimals like real USDC
    await mockUSDC.deployed();
    console.log("Mock USDC deployed to:", mockUSDC.address);

    const mockWBTC = await MockERC20.deploy("Mock Wrapped Bitcoin", "WBTC", 8); // 8 decimals like real WBTC
    await mockWBTC.deployed();
    console.log("Mock WBTC deployed to:", mockWBTC.address);

    const mockWETH = await MockERC20.deploy("Mock Wrapped Ethereum", "WETH", 18); // 18 decimals like real WETH
    await mockWETH.deployed();
    console.log("Mock WETH deployed to:", mockWETH.address);

    // Create default pool settings
    // Format: Gate (4 bytes) | Price Range (1 byte) | Target Slippages (15 bytes) | Pool Ratio Slippages (12 bytes)
    // Example settings:
    // - Gate: 1,000,000 USD (for switching to pool mode)
    // - Price Range: 50% (for pool mode liquidity range)
    // - Target Slippages: 3 tiers with different slippage targets
    const defaultSettings = "0x000F4240320A004C4B40050007A12000FFFFFF0AFFFFFF05FFFFFF01";

    // Add pools to PoolManager
    console.log("\n6. Adding pools to PoolManager...");
    
    await poolManager.addPool(mockUSDC.address, defaultSettings);
    console.log("USDC pool added");
    
    await poolManager.addPool(mockWBTC.address, defaultSettings);
    console.log("WBTC pool added");
    
    await poolManager.addPool(mockWETH.address, defaultSettings);
    console.log("WETH pool added");

    // Set up initial liquidity for testing
    console.log("\n7. Setting up initial test liquidity...");
    const initialAmount = hre.ethers.utils.parseUnits("10000", 6); // 10,000 USDC
    
    // Mint tokens to deployer for testing
    await mockUSDC.mint(deployer.address, initialAmount);
    console.log("Minted 10,000 USDC to deployer");
    
    // Approve PoolManager to spend tokens
    await mockUSDC.approve(poolManager.address, initialAmount);
    
    // Add initial liquidity
    await poolManager.addLiquidity(mockUSDC.address, initialAmount);
    console.log("Added initial liquidity to USDC pool");

    // Print deployment summary
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log("ELF Token:", elfToken.address);
    console.log("EASY Token:", easyToken.address);
    console.log("PoolManager:", poolManager.address);
    console.log("Mock USDC:", mockUSDC.address);
    console.log("Mock WBTC:", mockWBTC.address);
    console.log("Mock WETH:", mockWETH.address);
    
    console.log("\n=== CONTRACT VERIFICATION ===");
    if (hre.network.name !== "hardhat") {
        console.log("Run the following commands to verify contracts:");
        console.log(`npx hardhat verify --network ${hre.network.name} ${elfToken.address}`);
        console.log(`npx hardhat verify --network ${hre.network.name} ${easyToken.address}`);
        console.log(`npx hardhat verify --network ${hre.network.name} ${mockUSDC.address} "Mock USDC" "USDC" 6`);
        console.log(`npx hardhat verify --network ${hre.network.name} ${mockWBTC.address} "Mock Wrapped Bitcoin" "WBTC" 8`);
        console.log(`npx hardhat verify --network ${hre.network.name} ${mockWETH.address} "Mock Wrapped Ethereum" "WETH" 18`);
    }
    
    console.log("\n=== SETUP COMPLETE ===");
    console.log("You can now interact with the EasyDEX protocol!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });