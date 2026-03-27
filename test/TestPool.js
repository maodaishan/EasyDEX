const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Pool Contract", function () {
    let pool;
    let poolManager;
    let elfToken;
    let easyToken;
    let mockTokenA;
    let mockTokenB;
    let priceHelper;
    let owner;
    let user1;
    let user2;
    
    const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy mock tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockTokenA = await MockERC20.deploy("Token A", "TKA", 18);
        mockTokenB = await MockERC20.deploy("Token B", "TKB", 18);
        
        // Deploy price helper
        const SimplePriceHelper = await ethers.getContractFactory("SimplePriceHelper");
        priceHelper = await SimplePriceHelper.deploy();
        
        // Deploy ELF and Easy tokens
        const ELFToken = await ethers.getContractFactory("ELFToken");
        elfToken = await ELFToken.deploy();
        
        const EasyToken = await ethers.getContractFactory("EasyToken");
        easyToken = await EasyToken.deploy(0);
        
        // Deploy pool manager
        const PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await PoolManager.deploy(elfToken.address, easyToken.address);
        
        // Deploy pool
        const Pool = await ethers.getContractFactory("Pool");
        pool = await Pool.deploy(poolManager.address, priceHelper.address);
        
        // Register pool in manager
        await poolManager.addPool(pool.address);
        
        // Mint tokens to users
        await mockTokenA.mint(user1.address, ethers.parseEther("10000"));
        await mockTokenB.mint(user1.address, ethers.parseEther("10000"));
        await mockTokenA.mint(user2.address, ethers.parseEther("10000"));
        await mockTokenB.mint(user2.address, ethers.parseEther("10000"));
        
        // Set allowances
        await mockTokenA.connect(user1).approve(pool.address, ethers.parseEther("10000"));
        await mockTokenB.connect(user1).approve(pool.address, ethers.parseEther("10000"));
        await mockTokenA.connect(user2).approve(pool.address, ethers.parseEther("10000"));
        await mockTokenB.connect(user2).approve(pool.address, ethers.parseEther("10000"));
        
        await elfToken.connect(user1).approve(pool.address, ethers.parseEther("10000"));
        await elfToken.connect(user2).approve(pool.address, ethers.parseEther("10000"));
    });

    describe("Liquidity Operations", function () {
        it("Should add liquidity successfully", async function () {
            // Add initial liquidity
            const tx = await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("1000"),
                ethers.parseEther("2000"),
                ethers.parseEther("950"),
                ethers.parseEther("1900")
            );

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            // Check pool balances
            const poolInfoA = await pool.getPoolInfo(mockTokenA.address);
            const poolInfoB = await pool.getPoolInfo(mockTokenB.address);
            
            expect(poolInfoA.totalTokens).to.be.gt(0);
            expect(poolInfoB.totalTokens).to.be.gt(0);
        });

        it("Should remove liquidity successfully", async function () {
            // First add liquidity
            await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("1000"),
                ethers.parseEther("2000"),
                ethers.parseEther("950"),
                ethers.parseEther("1900")
            );

            // Get user's ELF balance
            const elfBalance = await elfToken.balanceOf(user1.address);
            expect(elfBalance).to.be.gt(0);

            // Remove liquidity
            const removeTx = await pool.connect(user1).removeLiquidity(
                elfBalance,
                [mockTokenA.address, mockTokenB.address],
                [ethers.parseEther("50"), ethers.parseEther("100")]
            );

            const receipt = await removeTx.wait();
            expect(receipt.status).to.equal(1);
        });

        it("Should handle ETH liquidity operations", async function () {
            // Add ETH liquidity
            const ethAmount = ethers.parseEther("1");
            const tokenAmount = ethers.parseEther("2000");
            
            const tx = await pool.connect(user1).addLiquidity(
                ETH_ADDRESS,
                mockTokenA.address,
                ethAmount,
                tokenAmount,
                ethers.parseEther("0.9"),
                ethers.parseEther("1900"),
                { value: ethAmount }
            );

            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            // Check ETH balance in pool
            const ethBalance = await ethers.provider.getBalance(pool.address);
            expect(ethBalance).to.be.gte(ethAmount);
        });
    });

    describe("Settings Management", function () {
        it("Should allow owner to update pool settings", async function () {
            const newSettings = "0x12345678901234567890123456789012"; // 32 bytes
            
            await pool.connect(owner).updateSettings(newSettings);
            
            const settings = await pool.getSettings();
            expect(settings).to.equal(newSettings);
        });

        it("Should not allow non-owner to update settings", async function () {
            const newSettings = "0x12345678901234567890123456789012";
            
            await expect(
                pool.connect(user1).updateSettings(newSettings)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Slippage Estimation", function () {
        beforeEach(async function () {
            // Add liquidity for slippage tests
            await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("10000"),
                ethers.parseEther("20000"),
                ethers.parseEther("9500"),
                ethers.parseEther("19000")
            );
        });

        it("Should estimate slippage correctly", async function () {
            const slippage = await pool.estimateSlippage(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("100")
            );
            
            expect(slippage).to.be.gte(0);
            expect(slippage).to.be.lte(10000); // Max 100% slippage
        });

        it("Should handle different slippage modes", async function () {
            // Test both setting mode and pool mode
            const amount1 = ethers.parseEther("100");
            const amount2 = ethers.parseEther("1000");
            
            const slippage1 = await pool.estimateSlippage(
                mockTokenA.address,
                mockTokenB.address,
                amount1
            );
            
            const slippage2 = await pool.estimateSlippage(
                mockTokenA.address,
                mockTokenB.address,
                amount2
            );
            
            // Larger amounts should generally have higher slippage
            expect(slippage2).to.be.gte(slippage1);
        });
    });

    describe("Withdrawal", function () {
        it("Should allow withdrawal of collected fees", async function () {
            // Add some liquidity first
            await pool.connect(user1).addLiquidity(
                mockTokenA.address,
                mockTokenB.address,
                ethers.parseEther("1000"),
                ethers.parseEther("2000"),
                ethers.parseEther("950"),
                ethers.parseEther("1900")
            );

            // Perform some swaps to generate fees (would need swap function)
            // For now, just test the withdrawal mechanism
            
            const initialBalance = await mockTokenA.balanceOf(owner.address);
            
            // Simulate fee collection by transferring some tokens to pool
            await mockTokenA.mint(pool.address, ethers.parseEther("10"));
            
            // Owner should be able to withdraw fees
            await pool.connect(owner).withdraw(mockTokenA.address, ethers.parseEther("5"));
            
            const finalBalance = await mockTokenA.balanceOf(owner.address);
            expect(finalBalance.sub(initialBalance)).to.equal(ethers.parseEther("5"));
        });

        it("Should not allow non-owner withdrawal", async function () {
            await expect(
                pool.connect(user1).withdraw(mockTokenA.address, ethers.parseEther("1"))
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});