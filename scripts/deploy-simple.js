const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Pool settings construction
// Layout (bytes, little-endian word):
//   bytes 0-3  : LQ_GATE (uint32)  - USD threshold for pool-mode vs settings-mode
//   byte  4    : LQ_TARGET_PRICE_RANGE (uint8) - price range % for pool mode
//   bytes 5-19 : SETTINGS_TARGET_SLIPPAGES - 3 stages × 5 bytes each
//                  each stage: [ ratio uint8 | edge uint32 ] (ratio in low byte)
//   bytes 20-31: SETTINGS_POOL_RATIO_SLIPPAGES (unused in this demo, leave 0)
// ---------------------------------------------------------------------------
function buildPoolSettings() {
    const GATE        = 50000n;   // Use pool-mode when pool TVL >= $50,000
    const PRICE_RANGE = 150n;     // 150% price range for pool mode

    // Slippage stages (packed low→high):
    //   stage1: $0      – $500k    → 0%  target slippage
    //   stage2: $500k   – $5M      → 5%  target slippage
    //   stage3: $5M+               → 10% target slippage
    const stage1 = (500000n    << 8n) | 0n;
    const stage2 = (5000000n   << 8n) | 5n;
    const stage3 = (0xFFFFFFFFn << 8n) | 10n;
    const slippageSettings = stage1 | (stage2 << 40n) | (stage3 << 80n);

    return GATE | (PRICE_RANGE << 32n) | (slippageSettings << 40n);
}

async function main() {
    console.log("Starting EasyDEX deployment...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(
        await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // -----------------------------------------------------------------------
    // 1. Deploy SimplePriceHelper (Oracle)
    // -----------------------------------------------------------------------
    console.log("1/7  Deploying SimplePriceHelper...");
    const PriceHelperFactory = await ethers.getContractFactory("SimplePriceHelper");
    const priceHelper = await PriceHelperFactory.deploy();
    await priceHelper.waitForDeployment();
    const priceHelperAddr = await priceHelper.getAddress();
    console.log("     ->", priceHelperAddr);

    // -----------------------------------------------------------------------
    // 2. Deploy ELFToken (liquidity receipt)
    // -----------------------------------------------------------------------
    console.log("2/7  Deploying ELFToken...");
    const ELFFactory = await ethers.getContractFactory("ELFToken");
    const elfToken = await ELFFactory.deploy();
    await elfToken.waitForDeployment();
    const elfTokenAddr = await elfToken.getAddress();
    console.log("     ->", elfTokenAddr);

    // -----------------------------------------------------------------------
    // 3. Deploy EasyToken (governance)
    // -----------------------------------------------------------------------
    console.log("3/7  Deploying EasyToken...");
    const EasyFactory = await ethers.getContractFactory("EasyToken");
    const easyToken = await EasyFactory.deploy(0); // defaultSettings = 0 (rewards disabled until set)
    await easyToken.waitForDeployment();
    const easyTokenAddr = await easyToken.getAddress();
    console.log("     ->", easyTokenAddr);

    // -----------------------------------------------------------------------
    // 4. Deploy PoolManager
    // -----------------------------------------------------------------------
    console.log("4/7  Deploying PoolManager...");
    const PMFactory = await ethers.getContractFactory("PoolManager");
    const poolManager = await PMFactory.deploy(priceHelperAddr, elfTokenAddr, easyTokenAddr);
    await poolManager.waitForDeployment();
    const poolManagerAddr = await poolManager.getAddress();
    console.log("     ->", poolManagerAddr);

    // -----------------------------------------------------------------------
    // 5. Wire up token permissions
    //    - ELFToken: set poolManager so it can mint/burn
    //    - EasyToken: set poolManager so it can mint rewards
    //    - Do NOT transfer EasyToken ownership to PoolManager —
    //      the owner (deployer) needs to keep calling updateSettings.
    //    - Transfer ELFToken ownership to PoolManager so only it can
    //      call setPoolManager in the future.
    // -----------------------------------------------------------------------
    console.log("5/7  Wiring token permissions...");
    await (await elfToken.setPoolManager(poolManagerAddr)).wait();
    await (await easyToken.setPoolManager(poolManagerAddr)).wait();
    await (await elfToken.transferOwnership(poolManagerAddr)).wait();
    // Keep easyToken ownership with deployer for settings governance
    console.log("     ELFToken poolManager set & ownership -> PoolManager");
    console.log("     EasyToken poolManager set, ownership kept with deployer");

    // -----------------------------------------------------------------------
    // 6. Deploy test tokens + set mock prices + create pools
    // -----------------------------------------------------------------------
    console.log("6/7  Deploying test tokens & creating pools...");
    const MockFactory = await ethers.getContractFactory("MockERC20");
    const poolSettings = buildPoolSettings();

    // TKA  – $1.00
    const tokenA = await MockFactory.deploy("Test Token A", "TKA", 18);
    await tokenA.waitForDeployment();
    const tokenAAddr = await tokenA.getAddress();
    await (await priceHelper.setMockPrice(tokenAAddr, 1n * 10n**8n, 8)).wait();
    await (await poolManager.addPool(tokenAAddr, poolSettings)).wait();
    console.log("     TKA ->", tokenAAddr);

    // TKB  – $2.00
    const tokenB = await MockFactory.deploy("Test Token B", "TKB", 18);
    await tokenB.waitForDeployment();
    const tokenBAddr = await tokenB.getAddress();
    await (await priceHelper.setMockPrice(tokenBAddr, 2n * 10n**8n, 8)).wait();
    await (await poolManager.addPool(tokenBAddr, poolSettings)).wait();
    console.log("     TKB ->", tokenBAddr);

    // USDC – $1.00 (6 decimals)
    const usdc = await MockFactory.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    const usdcAddr = await usdc.getAddress();
    await (await priceHelper.setMockPrice(usdcAddr, 1n * 10n**8n, 8)).wait();
    await (await poolManager.addPool(usdcAddr, poolSettings)).wait();
    console.log("     USDC ->", usdcAddr);

    // -----------------------------------------------------------------------
    // 7. Mint test tokens + add seed liquidity via PoolManager
    // -----------------------------------------------------------------------
    console.log("7/7  Minting tokens & seeding liquidity...");

    // Mint
    await (await tokenA.mint(deployer.address, ethers.parseEther("1000000"))).wait();
    await (await tokenB.mint(deployer.address, ethers.parseEther("1000000"))).wait();
    await (await usdc.mint(deployer.address, ethers.parseUnits("1000000", 6))).wait();

    // Seed liquidity: 100,000 TKA ($100k), 50,000 TKB ($100k), 100,000 USDC ($100k)
    const tkaAmt  = ethers.parseEther("100000");
    const tkbAmt  = ethers.parseEther("50000");
    const usdcAmt = ethers.parseUnits("100000", 6);

    await (await tokenA.approve(poolManagerAddr, tkaAmt)).wait();
    await (await poolManager.addLiquidity(tokenAAddr, tkaAmt)).wait();

    await (await tokenB.approve(poolManagerAddr, tkbAmt)).wait();
    await (await poolManager.addLiquidity(tokenBAddr, tkbAmt)).wait();

    await (await usdc.approve(poolManagerAddr, usdcAmt)).wait();
    await (await poolManager.addLiquidity(usdcAddr, usdcAmt)).wait();

    console.log("     Seeded: 100k TKA + 50k TKB + 100k USDC");

    // -----------------------------------------------------------------------
    // 8. Deploy Governance
    // -----------------------------------------------------------------------
    const GovFactory = await ethers.getContractFactory("Governance");
    const governance = await GovFactory.deploy(easyTokenAddr);
    await governance.waitForDeployment();
    const governanceAddr = await governance.getAddress();
    console.log("     Governance ->", governanceAddr);

    // -----------------------------------------------------------------------
    // Print summary
    // -----------------------------------------------------------------------
    const tvl = await poolManager.getTVL();
    const elfPrice = await poolManager.getELFPrice();

    console.log("\n=== Deployment Complete ===");
    console.log("Network    :", hre.network.name);
    console.log("Deployer   :", deployer.address);
    console.log("TVL        : $" + tvl.toString());
    console.log("ELF price  :", elfPrice.price.toString(), "/ 10^" + elfPrice.decimal);
    console.log("\nContract addresses:");
    console.log("  PriceHelper :", priceHelperAddr);
    console.log("  ELFToken    :", elfTokenAddr);
    console.log("  EasyToken   :", easyTokenAddr);
    console.log("  PoolManager :", poolManagerAddr);
    console.log("  Governance  :", governanceAddr);
    console.log("  TKA         :", tokenAAddr);
    console.log("  TKB         :", tokenBAddr);
    console.log("  USDC        :", usdcAddr);

    // -----------------------------------------------------------------------
    // Save deployment JSON
    // -----------------------------------------------------------------------
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            PriceHelper: priceHelperAddr,
            ELFToken:    elfTokenAddr,
            EasyToken:   easyTokenAddr,
            PoolManager: poolManagerAddr,
            Governance:  governanceAddr,
            TestTokens: {
                TokenA: tokenAAddr,
                TokenB: tokenBAddr,
                USDC:   usdcAddr
            }
        }
    };

    if (!fs.existsSync("deployments")) fs.mkdirSync("deployments");
    const deployFile = path.join("deployments", `${hre.network.name}.json`);
    fs.writeFileSync(deployFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("\nDeployment info saved to", deployFile);

    // -----------------------------------------------------------------------
    // Auto-update frontend/src/contracts.js with real addresses
    // -----------------------------------------------------------------------
    const contractsJsPath = path.join("frontend", "src", "contracts.js");
    if (fs.existsSync(contractsJsPath)) {
        let src = fs.readFileSync(contractsJsPath, "utf8");
        src = src.replace(
            /PriceHelper:\s*"0x[0-9a-fA-F]+"/,
            `PriceHelper: "${priceHelperAddr}"`
        ).replace(
            /ELFToken:\s*"0x[0-9a-fA-F]+"/,
            `ELFToken: "${elfTokenAddr}"`
        ).replace(
            /EasyToken:\s*"0x[0-9a-fA-F]+"/,
            `EasyToken: "${easyTokenAddr}"`
        ).replace(
            /PoolManager:\s*"0x[0-9a-fA-F]+"/,
            `PoolManager: "${poolManagerAddr}"`
        ).replace(
            /Governance:\s*"0x[0-9a-fA-F]+"/,
            `Governance: "${governanceAddr}"`
        ).replace(
            /TokenA:\s*"0x[0-9a-fA-F]+"/,
            `TokenA: "${tokenAAddr}"`
        ).replace(
            /TokenB:\s*"0x[0-9a-fA-F]+"/,
            `TokenB: "${tokenBAddr}"`
        ).replace(
            /USDC:\s*"0x[0-9a-fA-F]+"/,
            `USDC: "${usdcAddr}"`
        );
        fs.writeFileSync(contractsJsPath, src);
        console.log("frontend/src/contracts.js addresses updated automatically.");
    }

    return deploymentInfo;
}

main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
