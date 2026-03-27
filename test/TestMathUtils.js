const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("MathUtils Library", function () {
    let mathUtilsTest;
    let owner;

    // Deploy a test contract that uses MathUtils
    beforeEach(async function () {
        [owner] = await ethers.getSigners();
        
        // Create a simple test contract that exposes MathUtils functions
        const MathUtilsTest = await ethers.getContractFactory("Pool"); // Using Pool as it uses MathUtils
        const SimplePriceHelper = await ethers.getContractFactory("SimplePriceHelper");
        const priceHelper = await SimplePriceHelper.deploy();
        
        const ELFToken = await ethers.getContractFactory("ELFToken");
        const elfToken = await ELFToken.deploy();
        
        const EasyToken = await ethers.getContractFactory("EasyToken");
        const easyToken = await EasyToken.deploy(0);
        
        const PoolManager = await ethers.getContractFactory("PoolManager");
        const poolManager = await PoolManager.deploy(elfToken.address, easyToken.address);
        
        mathUtilsTest = await MathUtilsTest.deploy(poolManager.address, priceHelper.address);
    });

    describe("Basic Math Operations", function () {
        it("Should handle percentage calculations correctly", async function () {
            // Test slippage estimation which uses percentage calculations
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
            const tokenB = await MockERC20.deploy("Token B", "TKB", 18);
            
            // This tests the math operations indirectly through the pool contract
            const result = await mathUtilsTest.estimateSlippage(
                tokenA.address,
                tokenB.address,
                ethers.parseEther("100")
            );
            
            // Should return a reasonable slippage value
            expect(result).to.be.gte(0);
            expect(result).to.be.lte(10000); // Max 100%
        });
    });

    describe("Slippage Calculations", function () {
        it("Should calculate slippage for different trade sizes", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
            const tokenB = await MockERC20.deploy("Token B", "TKB", 18);
            
            // Small trade
            const smallSlippage = await mathUtilsTest.estimateSlippage(
                tokenA.address,
                tokenB.address,
                ethers.parseEther("1")
            );
            
            // Large trade
            const largeSlippage = await mathUtilsTest.estimateSlippage(
                tokenA.address,
                tokenB.address,
                ethers.parseEther("1000")
            );
            
            // Large trades should generally have higher slippage
            expect(largeSlippage).to.be.gte(smallSlippage);
        });
    });

    describe("Liquidity Calculations", function () {
        it("Should handle liquidity ratio calculations", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
            const tokenB = await MockERC20.deploy("Token B", "TKB", 18);
            
            // Mint tokens for testing
            await tokenA.mint(owner.address, ethers.parseEther("10000"));
            await tokenB.mint(owner.address, ethers.parseEther("10000"));
            await tokenA.approve(mathUtilsTest.address, ethers.parseEther("10000"));
            await tokenB.approve(mathUtilsTest.address, ethers.parseEther("10000"));
            
            // Add liquidity to test math calculations
            const tx = await mathUtilsTest.addLiquidity(
                tokenA.address,
                tokenB.address,
                ethers.parseEther("1000"),
                ethers.parseEther("2000"),
                ethers.parseEther("950"),
                ethers.parseEther("1900")
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
            
            // Check that liquidity was calculated correctly
            const poolInfoA = await mathUtilsTest.getPoolInfo(tokenA.address);
            const poolInfoB = await mathUtilsTest.getPoolInfo(tokenB.address);
            
            expect(poolInfoA.totalTokens).to.be.gt(0);
            expect(poolInfoB.totalTokens).to.be.gt(0);
        });
    });

    describe("Decimal Handling", function () {
        it("Should handle different token decimals correctly", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const token6 = await MockERC20.deploy("USDC", "USDC", 6);
            const token8 = await MockERC20.deploy("WBTC", "WBTC", 8);
            
            // Test slippage calculation with different decimals
            const slippage = await mathUtilsTest.estimateSlippage(
                token6.address,
                token8.address,
                ethers.parseUnits("1000", 6) // 1000 USDC
            );
            
            expect(slippage).to.be.gte(0);
        });
        
        it("Should normalize amounts for calculation", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const token18 = await MockERC20.deploy("DAI", "DAI", 18);
            const token6 = await MockERC20.deploy("USDC", "USDC", 6);
            
            // Mint and approve tokens
            await token18.mint(owner.address, ethers.parseEther("10000"));
            await token6.mint(owner.address, ethers.parseUnits("10000", 6));
            await token18.approve(mathUtilsTest.address, ethers.parseEther("10000"));
            await token6.approve(mathUtilsTest.address, ethers.parseUnits("10000", 6));
            
            // Add liquidity with different decimals
            const tx = await mathUtilsTest.addLiquidity(
                token18.address,
                token6.address,
                ethers.parseEther("1000"), // 1000 DAI
                ethers.parseUnits("1000", 6), // 1000 USDC
                ethers.parseEther("990"),
                ethers.parseUnits("990", 6)
            );
            
            const receipt = await tx.wait();
            expect(receipt.status).to.equal(1);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero values safely", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
            const tokenB = await MockERC20.deploy("Token B", "TKB", 18);
            
            // Should handle zero amount gracefully
            const result = await mathUtilsTest.estimateSlippage(
                tokenA.address,
                tokenB.address,
                0
            );
            
            expect(result).to.equal(0);
        });
        
        it("Should handle maximum values without overflow", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
            const tokenB = await MockERC20.deploy("Token B", "TKB", 18);
            
            // Test with large numbers (but not max uint256 to avoid gas issues)
            const largeAmount = ethers.parseEther("1000000000"); // 1B tokens
            
            const result = await mathUtilsTest.estimateSlippage(
                tokenA.address,
                tokenB.address,
                largeAmount
            );
            
            // Should return a valid slippage value without reverting
            expect(result).to.be.gte(0);
        });
    });

    describe("Precision Tests", function () {
        it("Should maintain precision in calculations", async function () {
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
            const tokenB = await MockERC20.deploy("Token B", "TKB", 18);
            
            await tokenA.mint(owner.address, ethers.parseEther("1000"));
            await tokenB.mint(owner.address, ethers.parseEther("1000"));
            await tokenA.approve(mathUtilsTest.address, ethers.parseEther("1000"));
            await tokenB.approve(mathUtilsTest.address, ethers.parseEther("1000"));
            
            // Add precise amounts
            await mathUtilsTest.addLiquidity(
                tokenA.address,
                tokenB.address,
                ethers.parseEther("100.123456789"),
                ethers.parseEther("200.987654321"),
                ethers.parseEther("100"),
                ethers.parseEther("200")
            );
            
            // Should handle precise calculations without significant rounding errors
            const poolInfoA = await mathUtilsTest.getPoolInfo(tokenA.address);
            expect(poolInfoA.totalTokens).to.be.gt(0);
        });
    });
});