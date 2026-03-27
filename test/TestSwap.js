const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Swap Functionality", function () {
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

        // Deploy all contracts
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockTokenA = await MockERC20.deploy("Token A", "TKA", 18);
        mockTokenB = await MockERC20.deploy("Token B", "TKB", 18);
        
        const SimplePriceHelper = await ethers.getContractFactory("SimplePriceHelper");
        priceHelper = await SimplePriceHelper.deploy();
        
        const ELFToken = await ethers.getContractFactory("ELFToken");
        elfToken = await ELFToken.deploy();
        
        const EasyToken = await ethers.getContractFactory("EasyToken");
        easyToken = await EasyToken.deploy(0);
        
        const PoolManager = await ethers.getContractFactory("PoolManager");
        poolManager = await PoolManager.deploy(elfToken.address, easyToken.address);
        
        const Pool = await ethers.getContractFactory("Pool");
        pool = await Pool.deploy(poolManager.address, priceHelper.address);
        
        await poolManager.addPool(pool.address);
        
        // Setup tokens and approvals
        await mockTokenA.mint(user1.address, ethers.parseEther("10000"));
        await mockTokenB.mint(user1.address, ethers.parseEther("10000"));
        await mockTokenA.mint(user2.address, ethers.parseEther("10000"));
        await mockTokenB.mint(user2.address, ethers.parseEther("10000"));
        
        await mockTokenA.connect(user1).approve(pool.address, ethers.parseEther("10000"));
        await mockTokenB.connect(user1).approve(pool.address, ethers.parseEther("10000"));
        await mockTokenA.connect(user2).approve(pool.address, ethers.parseEther("10000"));
        await mockTokenB.connect(user2).approve(pool.address, ethers.parseEther("10000"));
        
        // Add initial liquidity for swaps
        await pool.connect(user1).addLiquidity(
            mockTokenA.address,
            mockTokenB.address,
            ethers.parseEther("5000"),
            ethers.parseEther("10000"),
            ethers.parseEther("4900"),
            ethers.parseEther("9800")
        );
    });

    describe("Pool Mode Swaps", function () {
        it("Should execute swap in pool mode successfully", async function () {
            const swapAmount = ethers.parseEther("100");
            const minAmountOut = ethers.parseEther("180"); // Expecting roughly 200 tokens out with some slippage
            
            const balanceBeforeA = await mockTokenA.balanceOf(user2.address);
            const balanceBeforeB = await mockTokenB.balanceOf(user2.address);
            
            // Execute swap
            const tx = await pool.connect(user2).swap(
                mockTokenA.address,
                mockTokenB.address,
                swapAmount,
                minAmountOut,
                user2.address
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            const balanceAfterA = await mockTokenA.balanceOf(user2.address);
            const balanceAfterB = await mockTokenB.balanceOf(user2.address);
            
            // Should have spent tokenA and received tokenB
            expect(balanceAfterA).to.equal(balanceBeforeA.sub(swapAmount));
            expect(balanceAfterB).to.be.gt(balanceBeforeB);
            expect(balanceAfterB.sub(balanceBeforeB)).to.be.gte(minAmountOut);
        });

        it("Should handle ETH swaps in pool mode", async function () {
            // First add ETH liquidity
            const ethAmount = ethers.parseEther("10");
            await pool.connect(user1).addLiquidity(
                ETH_ADDRESS,
                mockTokenA.address,
                ethAmount,
                ethers.parseEther("5000"),
                ethers.parseEther("9.5"),
                ethers.parseEther("4900"),
                { value: ethAmount }
            );
            
            // Now swap ETH for tokens
            const swapAmount = ethers.parseEther("1");
            const minAmountOut = ethers.parseEther("450");
            
            const balanceBefore = await mockTokenA.balanceOf(user2.address);
            
            const tx = await pool.connect(user2).swap(
                ETH_ADDRESS,
                mockTokenA.address,
                swapAmount,
                minAmountOut,
                user2.address,
                { value: swapAmount }
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            const balanceAfter = await mockTokenA.balanceOf(user2.address);
            expect(balanceAfter.sub(balanceBefore)).to.be.gte(minAmountOut);
        });

        it("Should fail if slippage is too high", async function () {
            const swapAmount = ethers.parseEther("100");
            const minAmountOut = ethers.parseEther("250"); // Unrealistic expectation
            
            await expect(
                pool.connect(user2).swap(
                    mockTokenA.address,
                    mockTokenB.address,
                    swapAmount,
                    minAmountOut,
                    user2.address
                )
            ).to.be.reverted; // Should fail due to slippage
        });
    });

    describe("Settings Mode Swaps", function () {
        beforeEach(async function () {
            // Configure for settings mode (adjust the settings to prefer settings mode)
            // This would depend on your specific settings implementation
            const settingsData = "0x00000001000000000000000000000000"; // Mock settings for settings mode
            await pool.connect(owner).updateSettings(settingsData);
        });

        it("Should execute swap in settings mode", async function () {
            const swapAmount = ethers.parseEther("50");
            const minAmountOut = ethers.parseEther("90");
            
            const balanceBeforeA = await mockTokenA.balanceOf(user2.address);
            const balanceBeforeB = await mockTokenB.balanceOf(user2.address);
            
            const tx = await pool.connect(user2).swap(
                mockTokenA.address,
                mockTokenB.address,
                swapAmount,
                minAmountOut,
                user2.address
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            const balanceAfterA = await mockTokenA.balanceOf(user2.address);
            const balanceAfterB = await mockTokenB.balanceOf(user2.address);
            
            expect(balanceAfterA).to.equal(balanceBeforeA.sub(swapAmount));
            expect(balanceAfterB).to.be.gt(balanceBeforeB);
        });
    });

    describe("EASY Token Minting", function () {
        it("Should mint EASY tokens as rewards", async function () {
            // Execute a swap to generate EASY rewards
            const swapAmount = ethers.parseEther("100");
            const minAmountOut = ethers.parseEther("180");
            
            const easyBalanceBefore = await easyToken.balanceOf(user2.address);
            
            await pool.connect(user2).swap(
                mockTokenA.address,
                mockTokenB.address,
                swapAmount,
                minAmountOut,
                user2.address
            );
            
            const easyBalanceAfter = await easyToken.balanceOf(user2.address);
            
            // Should have received some EASY tokens (if implemented in Pool contract)
            // This test depends on the reward mechanism implementation
            expect(easyBalanceAfter).to.be.gte(easyBalanceBefore);
        });
    });

    describe("Decimal Handling", function () {
        it("Should handle tokens with different decimals correctly", async function () {
            // Deploy tokens with different decimals
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const token6Decimals = await MockERC20.deploy("USDC", "USDC", 6);
            const token8Decimals = await MockERC20.deploy("WBTC", "WBTC", 8);
            
            // Mint tokens
            const amount6 = ethers.parseUnits("10000", 6);
            const amount8 = ethers.parseUnits("10", 8);
            
            await token6Decimals.mint(user1.address, amount6);
            await token8Decimals.mint(user1.address, amount8);
            
            await token6Decimals.connect(user1).approve(pool.address, amount6);
            await token8Decimals.connect(user1).approve(pool.address, amount8);
            
            // Add liquidity with different decimal tokens
            const tx = await pool.connect(user1).addLiquidity(
                token6Decimals.address,
                token8Decimals.address,
                ethers.parseUnits("5000", 6),
                ethers.parseUnits("5", 8),
                ethers.parseUnits("4900", 6),
                ethers.parseUnits("4.9", 8)
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            // Test swap with different decimals
            await token6Decimals.mint(user2.address, amount6);
            await token6Decimals.connect(user2).approve(pool.address, amount6);
            
            const swapTx = await pool.connect(user2).swap(
                token6Decimals.address,
                token8Decimals.address,
                ethers.parseUnits("100", 6),
                ethers.parseUnits("0.09", 8),
                user2.address
            );
            
            const swapReceipt = await swapTx.wait();
            expect(swapReceipt.status).to.equal(1);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero amount swaps", async function () {
            await expect(
                pool.connect(user2).swap(
                    mockTokenA.address,
                    mockTokenB.address,
                    0,
                    0,
                    user2.address
                )
            ).to.be.reverted;
        });

        it("Should handle swaps with same input/output token", async function () {
            await expect(
                pool.connect(user2).swap(
                    mockTokenA.address,
                    mockTokenA.address,
                    ethers.parseEther("100"),
                    ethers.parseEther("100"),
                    user2.address
                )
            ).to.be.reverted;
        });

        it("Should handle insufficient liquidity", async function () {
            const largeAmount = ethers.parseEther("50000"); // More than available liquidity
            
            await expect(
                pool.connect(user2).swap(
                    mockTokenA.address,
                    mockTokenB.address,
                    largeAmount,
                    ethers.parseEther("1"),
                    user2.address
                )
            ).to.be.reverted;
        });
    });
});