# EasyDEX (中文请往下拉）
An DEX considering liquidity grows on different stages. 

## English introduction
Liquidity is precious for DeFi, normally we have different liquidity at different stages , so if we use a single protocol (strategy) to calculate the slippage under different liquidity, we’ll get big difference, which may cause loss to the traders. Uniswap protocols can’t work well on DEXs who don’t have enough liquidity. EasyDEX figured out a way to have different protocols under different liquidities to calculate slippage, to help DEXs work well on all situations.

### Considerations
1. Supplying liquidity for every swap pair like Uniswap, will disperse the precious liquidity. So we consider supplying liquidity per token, not swap pair. 
2. Because we’re not supplying liquidity via swap pair, so we can’t generate price locally, we need oracle to input the price.
3. Slippage is necessary, if we don’t have slippage, LP will bear the loss. 
The deeper liquidity, the lower slippage, and the swap result is expected. The liquidity is accumulated, so we need solution to supply low slippage when we don’t have deep liquidity, to protect the traders. So we consider have a threshold , if liquidity is lower than the threshold, we control the slippage via preset parameters, if liquidity is higher than the threshold, the slippage’s calculated via liquidity. The choice of strategy is auto switched by contract.
4. When LP supply liquidity, we sum up all liquidity in all pools to calculate how much receipt(an ERC20 token) he/she can get, and when LP remove the liquidity, we use the same way to calculate how much token he/she could withdraw. It’s like what GMX did.

### Detailed design

#### Liquidity

EasyDEX only accepts limited kind of token to build up the pools, and we can add new token by EASY holders voting. 
We don’t have swap pairs, for a single token, we have only one pool, to gather the liquidity together.

We use “ELF”, an ERC20 token as the receipt of liquidity for LP. When LP add liquidity to a pool, we’ll calculate the value (by USD) of the liquidity, and calculate the ELF token price. By dividing the liquidity value by ELF price, we got how much ELF token we should mint to the LP. When LP remove the liquidity, we calculate the ELF token again, and multiply with the ELF that LP have, we get the value he/she could withdraw, and he/she could withdraw from any pool we have, at the same time, these ELF are burned.

How to calculate price of ELF:  We have many pools, each pool is for one token. Each pool stores how many token it has. We get token price from oracle, and calculate value of the pool. By summing them up, we get the total value for all pools, then we divide it with amount of ELF, we get the price of ELF.

E.g. suppose we have BTC, ETH, USDC pools. The amount and price are :
![image](https://user-images.githubusercontent.com/41321062/225841720-d1d2dceb-6111-4c0e-b3de-40d16589649e.png)

Currently we already minted 400000 ELF.

Now a LP add 50000 USDC to the pool, how many ELF could he/she get?

The whole value now is : 20000*5 + 3000*100 + 1*400000 = 800000 USD

Current ELF price is : 800000 / 400000 = 2 USD

So the LP could get : 50000 / 2 = 25000 ELF


When this LP wishes to remove liquidity, suppose the pools situation are as below:

![image](https://user-images.githubusercontent.com/41321062/225842007-14e487a7-7ab5-46be-8855-99d31c6607d3.png)

Currently ELF amount is :480000.

Current ELF price is : 2.155

So the LP could get :25000*2.155=53875 USD token ,he could get equivalent token from any of the pools. 


#### Swap

Assume the trader wish to swap in X token and wish to swap out Y token, the input is ∆x, how many Y could he/she get?

We get price of X from oracle, marked as p1; then calculate the slippage, and calculate the price with slippage, marked as p2; we get the middle of p1 and p2, as the final price , multiply with ∆x, we get ∆y. that it : ∆y = ∆x * (p1 + p2) / 2. Then we calculate the fee with a ratio, the fee is counted by Y. 
    
#### Slippage

We have 2 strategies to calculate slippage:

1. According to the preset parameters in the contract.
2. Considering the liquidity of Y pool, assuming we have an X pool have the same value. Referring to Uniswap V3, we put them together to be a swap pair . the original price can be got from oracle, the price range we supply liquidity is preset, so we can use Uniswap V3 protocol to calculate how many Y should be swapped out. 

Strategy 1 could be used on all situations, but its parameters should be set carefully. They can be adjusted via voting.

Strategy 2 could only be used when we have deep liquidity on Y pool. 

    
  We should use strategy 1 or 2?  EasyDEX allows us to setup a threshold. When liquidity is lower than the threshold, strategy 1 is used; when liquidity is higher than the threshold, strategy 2 is used. It’s auto decided in the contract. The threshold could be set for each pool separately , and can be adjusted by voting. 
    
##### Strategy 1:  Calculate slippage via preset parameters
Consider below factors have influences on the slippage:
1. Liquidity of the swapped out pool.
2. Percentage of the amount of the swapped out token to the pool liquidity.
3. Ratio of liquidity of the swapped in pool to the swapped out pool.

  The liquidity of the swapped out pool is the most significant influence. So we get a target slippage from it (marked as T), e.g. When the liquidity is 500k USD, the target slippage is 5% of the oracle price. It has default settings, and can be updated by community via voting. 
  
  When the liquidity of the pool is low, we expect the ratio be small, because the low liquidity can’t support big swapped out amount. When the swapped value is big, we shouldn’t have big slippage just because we don’t have enough liquidity (which’s our problem), which will cause loss to the trader. It’s not an expected behavior. 
  
  When the liquidity of the pool is high, the target slippage could be big. So if we have a big value transaction, it’s expected to have bigger slippage, it’s an expected behavior.
  The default settings are as below:
  
![image](https://user-images.githubusercontent.com/41321062/225842742-22e74492-ccd1-482d-a4da-d194276a8c0c.png)

  
  Percentage of the amount of the swapped out token to the pool liquidity is the second factor, marked as R. Assume the trader wish to swap in X token and swap out Y token. The swapped in amount is ∆x. The token amount of Y pool is y. From oracle, we could get the price of x to y is p = y/x, so ∆y=∆x*p, we could get ∆y. Then we calculate R = ∆y/y.

  
  The ratio of liquidity of the swapped in pool to the swapped out pool is the 3rd factor, marked as X. we can easily calculate it. EasyDEX wish to balance the liquidity of the different pools. We don’t wish some pool liquidity is very high while some other pools are very low. So when a trader wish to swap in X and swap out Y, if X liquidity is already high and Y liquidity is low, we wish to depress such trade by increase the slippage, so the trader gets less Y token. The influence shouldn’t be big, when the liquidity of X and Y don’t have big gap, X should be almost 1. To save gas, we can simply get X by a map. Here’s how it looks like:
![image](https://user-images.githubusercontent.com/41321062/225843398-d7f7e28e-d6ba-4adb-aebe-7c9e4e6588b4.png)
	
  Considering the price got from oracle is p, then :
		                         Slippage=p×T×R×X

Example 1:

Assume trader wishes to swap in 2 ETH and swap out DAI. From oracle we get the price is :    1 ETH = 2000 DAI, that is : 1 DAI = 0.0005 ETH. 

Currently the liquidity of DAI pool is 200000 USD, the liquidity of ETH pool is 50 ETH (that is :100000 USD). 
Currently we’re consuming DAI pool, so: 

T=2%

∆y=2*2000=4000，R=4000/200000=0.02

X=1

P =1/2000 = 0.0005

Slippage = p* T* R* X = 0.0005* 0.02* 0.02* 1 = 0.0000002

After considering slippage, 

the price of DAI to ETH is : p=[0.0005+(0.0005+0.0000002)]/2 = 0.0005001

the price of ETH to DAI is : 1/0.0005001 = 1999.6

So the trader finally got DAI amount: 3999.2



Example 2:

Assume trader wish to swap in 100 ETH and swap out DAI. 
From oracle we get the current price is 1 ETH = 2000 DAI. 
Currently the liquidity of DAI pool is 10 000 000 USD, the liquidity of ETH pool is 5000 ETH, that is 10 000 000 USD, currently we’re consuming DAI pool.

T = 20%

∆y = 100 * 2000 = 200000 USD， R= 200000/10000000 = 2%

X = 1

Price of DAI to ETH is : p = 1/2000 = 0.0005

So：  Slippage = p* T* R* X = 0.0005* 0.2* 0.02* 1 = 0.000002
After considering slippage, the price of DAI to ETH is :

P’ = [0.0005 + (0.0005 + 0.000002)]/2 = 0.000501
	
The price of ETH to DAI is : 1/0.000501 = 1996

So the trader finally can get 199600 DAI. 


Considering above examples, we could know that when the liquidity of EasyDEX is low, we could also get very small slippage. When the trading value gets bigger, the slippage gets bigger too, but still reasonable.


##### Strategy 2: Using the liquidity of the pool to get slippage


The solution looks like Uniswap V3, the differences are:
1. Current price is got from oracle
2. When trader wishes to swap, only the swap out pool is used, so the slippage direction is always determined. So we could assume that before the swap, the price is always at the endpoint of the curve, the swap will make it slide to another endpoint.
3. The contract will define the price area when the pool supplies liquidity, which could be updated by voting. The default area is 50% of the oracle price.


Example 3:

The trader wishes to swap in 100 000 DAI ,to get ETH. The oracle price is 1 ETH = 2000 DAI. 

Currently the ETH pool has 1000 ETH (values  2000 000 DAI), currently the area that contract supplies liquidity is 50% of oracle price, that is :the price of ETH to DAI is: 2000 -3000.

Because the liquidity of ETH pool is 2000 000 DAI, so the contract will have a virtual pool of DAI whose liquidity is 2000 000 DAI, to finish the trade. As shown in the graph, before the trade, the price is at point a. 

![image](https://user-images.githubusercontent.com/41321062/221360616-d6a7acba-46c9-4d2d-add2-50b832ae8684.png)


According to the fomula：

![image](https://user-images.githubusercontent.com/41321062/221360652-dc34a2f4-424f-4b66-a4f1-8329172655ef.png)

We can get : L = 248452

After the trade, the price will slide from point a to point c, as in the graph, the orange line stands for the point a, the blue line stands for the point c.

![image](https://user-images.githubusercontent.com/41321062/221360914-ac6cffa7-37a9-4dbd-8352-b43d55310637.png)

At point a: 

(Xv+1000)*Yv=248452^2

Yv/(Xv+1000)=2000

We can get：Xv=4555.56，Yv=11111120


At point C：

(Xv+1000-∆x)(Yv+100000)=248452^2

After input Xv, Yv, we can get : ∆x=49.58，

So the trader can get 49.58 ETH, the average trading price is 2017 DAI/ETH, and the slippage is 2*(2017 – 2000) = 34.

#### Fee
When trader swap on EasyDEX, the contract will charge fee for it. The fee ratio is decided by the community via voting. Default fee ratio is 0.1%.
The fee will be gave back to the LP , and the EASY token holder. LP could get 70% of it, and EASY holder could get 30%. The ratio could be adjusted via voting. 

#### EASY token

EASY token is issued for governance. The total supply is 1000 000 000. The initial team will get 10 000 000, the others will be mined when LP supplying liquidity, or traders do the swap. The ratio of getting EASY token is decided by the TVL. For example:
When TVL is smaller than 50 000 000 USD, supplying 1 USD liquidity , could get 1 EASY, or trading 100 USD, can get 1 EASY. When TVL is between 50 000 000 USD and 500 000 000 USD, the EASY got is half of previous. The could encourage LP or trader to use EasyDEX at the startup time.

EASY holder could vote to decide various settings on EasyDEX, e.g. how to distribute the fee; the threshold of changing strategy of a pool; or the slippage related parameters. 


## 中文介绍：

在DEX发展的不同阶段，其所拥有的流动性可能是差别非常大的。流动性的获取是比较困难的，因为你的DEX要在与其他DEX的竞争中说服LP向你提供流动性。因此像Uniswap那样的协议无法适合大部分DEX，因为单纯使用x*y=k，在协议发展的早期无法有效控制滑点。
    
### 主要思考
1. 像Uniswap那样为每个交易对单独提供流动性的方式，在流动性很珍贵的情景下，会进一步分散流动性，因此考虑按币种提供流动性，从而使流动性能聚合在一起。
2. 因为不是按交易对提供流动性，所以无法独立生成价格，因此价格需要靠预言机输入。
3. 滑点是必要的，没有滑点就变成LP补贴交易者了。流动性越充足，滑点越低，对交易者来说越划算，而且交易结果能符合预期。DEX的流动性是慢慢积累的，因此需要有机制在早期流动性不足时也能提供低滑点，保障交易者的利益，吸引交易者来交易。考虑对流动性池设置门槛，低于门槛使用特定机制控制滑点范围，高于门槛时转换为根据交易池流动性自动计算生成滑点。
4. 当LP提供流动性时，使用篮子中的所有资金池的所有流动性池综合计算其可获得的收据（ERC20 token)；撤出流动性时，使用同样方法计算其可提取的价值，可在任意流动性池中提取出该价值的token。
    
### 详细设计
#### 流动性
EasyDEX只接受指定的币种建立流动性池，可通过持币者投票增加币种。

各个流动性池不会形成固定的交易对，从而让每个币种的流动性都聚合在同一个池里。

使用ERC20 token "ELF"作为LP提供流动性的收据，当LP提供流动性到某个池子时，会计算当前ELF的价格，然后用LP提供的流动性价值除以价格，得到LP收到的ELF数量，然后mint出相应ELF给LP;当LP撤回流动性时，会计算当前ELF的价格，根据撤回的ELF的数量计算出需取出的价值，LP可以在任意一个池子中取出等于该价值的币，同时ELF会被销毁。

ELF价格的计算方法为：所有池子的总价值除以当前ELF的数量。每个池子会记录自己有多少币，从oracle获取价格后，计算出其价值。然后各个池子的价值相加，即可得到总价值。

例如：假设当前有BTC, ETH, USDC三个池子，当前价格和数量分别为：
	币种			价格(USD)		数量
	BTC				20000			5
	ETH				3000			100
	USDC			1				  400000
当前已发行400000个ELF；
新LP提供50000个USDC进入资金池，则他可获得多少ELF?

当前总价值为：20000 x 5 + 3000 x 100 + 1 x 400000 = 800000 USD

当前ELF价格为：800000/400000 = 2 USD

该LP可获得的ELF = 50000/2=25000个。

当该LP要撤出流动性时，假设池子的价格和数量变为如下情况：
	币种			价格(USD)		数量
	BTC				22000			5.2
	ETH				3500			120
	USDC			1				  500000
  
当前发行ELF总数为480000个。
因此当前ELF价格为：2.155
因此该LP可获得价值25000*2.155=53875 USD的币，可以从当前三个池子中任选一个提取出相应价值的币。


#### 交易

假设交易者试图用∆x个x币换取EasyDEX上的y币，需x,y两种币都属于EasyDEX支持的池子。此时需计算出能换取多少个y币。

我们使用oracle获取主流交易所的y币用x计价的价格,记为p1，然后计算出当前的滑点，算出实施滑点之后的价格，记为p2，用oracle价格和滑点价格的中值作为最终价格，乘以∆x,得到∆y。及∆y=∆x*(p1+p2)/2。然后计算出手续费fee，fee以y记。

如果∆y-fee小于当前y池能提供的流动性，则收取交易者的∆x到x池，并转账∆y-fee个y给交易者，交易完成；否则交易失败，提示用户当前y池流动性不足。
    
#### 滑点计算

考虑提供两种可选方法计算滑点：
1. 以合约中设置好的各种参数，计算出当前交易的滑点。
2. 通过待兑换币流动性池的流动性，虚拟出当前交易对的另一种币的流动性（实际并不参与提供流动性），参考Uniswap v3的方法，通过一个设定好的流动性价格区间，计算出滑点。

方法1可以被应用于所有情况，但是它的参数设置需要非常谨慎，这些参数可以通过社区投票调整。
方法2只适用于被兑换币种池子的流动性比较充足的情况。
    

如何选择方法1还是方法2？EasyDEX允许针对被使用的流动性池设置一个阈值，当流动性低于该阈值时使用方法1，当流动性高于该阈值时使用方法2，方法的选择由合约自动完成。如果该阈值被设置得极大，如超过了可能的最大值，则在任何情况下均使用方法1。该阈值可以由社区投票调整。
    
##### 方法一：通过参数计算滑点
    
考虑如下三个因素对滑点产生影响：
1. 当前被兑换池自身的流动性
2. 要兑换出的币的数量占当前池流动性的百分比
3. 交易者提供的币种的池的流动性，与期望兑换的币种的池的流动性之比

当前被兑换池自身的流动性是最重要的影响因素，因此我们用它产生一个目标比率(记为T)，如“滑点为oracle价格的5%”。这个比率如何生成呢?它是一个设定值，有初始值，也可以被社区投票修改。当该池自身流动性较小时，我们会期望这个比率会比较小，因为较小的流动性无法支撑很大的兑换量，当兑换量比较大时，不应该因为流动性不足而产生大滑点，给交易者带来损失；当自身流动性比较大时，这个比率可以比较大，因为此时如果交易量很大（如可能消耗光流动性），产生较大的滑点是应该的。该比率默认值如下：

![image](https://user-images.githubusercontent.com/41321062/221361310-41a43c88-ee18-4092-af45-51d64b78018e.png)

要兑换出的币占流动性的比率是第二个因素，记为R。假设交易者要用∆x个x币兑换池子的y币，当前池子中有Y个y币，我们通过oracle获知x对y的价格p=y/x，通过∆y=∆x*p获得应兑换得到的∆y，计算R=∆y/Y.

EasyDEX自身的x币池子流动性和y币池子流动性的比值记为X，通过oracle获取x对y的价格后可以计算得出X。EasyDEX希望平衡自身各个池子之间的流动性，不让某个池子特别大，而其他池子特别小。因此当交易者期望用x换取y时，如果自身x池的流动性已经很大，而y流动性池较小，就希望能抑制一下这类型的交易，可用的方法就是增大滑点，这样交易者获得的y就会相对少一点。但是X的影响不应该很大，在x池和y池相差不是特别大的情况下，X都应该趋向为1。出于节约gas和简单起见，X可用查表法获得，如下是默认值：
![image](https://user-images.githubusercontent.com/41321062/221361336-aa072c8a-7c58-45a0-b54c-59dd83638247.png)


从oracle获得的价格记为p，则:
滑点= p*T*R*X

例1：
假设当前用户想要用2ETH兑换DAI，从oracle查得的价格为1 ETH = 2000 DAI，即 1 DAI = 0.0005 ETH。当前DAI池的流动性为20w USD，ETH池的流动性为50ETH=10w USD，当前消耗的是DAI池，因此：
T=2%
∆y=2*2000=4000，R=4000/200000=0.02
X=1
DAI对ETH的价格p为1/2000=0.0005
所以滑点=p*T*R*X = 0.0005*0.02*0.02*1 = 0.0000002
考虑滑点后，DAI对ETH价格为：p = [0.0005+（0.0005+0.0000002)]/2=0.0005001
			     ETH对DAI价格为：1/0.0005001=1999.6
最终兑换获得的DAI为3999.2个。 

例2：
假设当前用户想要用100ETH兑换DAI，从oracle查的的价格为 1 ETH = 2000 DAI。当前DAI池的流动性为1000w USD, ETH池的流动性为5000 ETH = 1000w USD，当前消耗的是DAI池，因此：
T=20%
∆y = 100 * 2000 = 20w USD， R= 20w/1000w = 2%
X = 1
DAI对ETH的价格p为1/2000=0.0005
所以滑点=p*T*R*X = 0.0005*0.2*0.02*1 = 0.000002
考虑滑点后，DAI对ETH价格为：p = [0.0005+（0.0005+0.000002)]/2=0.000501
			     ETH对DAI价格为：1/0.000501=1996
最终兑换获得的DAI为199600个。 

通过以上例子，可以观察到，当EasyDEX的资金池流动性较小时，也可以获得很小的滑点，而当交易量变大时，滑点会变大，但是在可控范围内。

##### 方法二：通过自身流动性计算滑点

该方法类似Uniswap v3，不同点为：
	1. 当前价格由oracle输入
	2. 当交易者提出交易时，只需用到要兑换的币的资金池，此时滑点方向是固定的，因此相当于交易前，价格总是处于流动性曲线的端点，交易会使曲线滑向另一端。
	3. 由合约指定当前资金池提供流动性的价格范围，该范围可以通过持币者投票决定，例如默认值为当前价格的20%.
例子：
交易者用DAI换取ETH，当前价格为 1 ETH = 2000 DAI。交易者投入100000 DAI。
当前ETH池流动性为1000 ETH，价值2000000 DAI，当前提供流动性的价格范围为当前价格的50%，即2000DAI – 3000 DAI。
因为ETH池的流动性为2000000 DAI，因此合约会虚拟出2000000 DAI的池参与交易，如图所示，交易前处于a点。
 ![image](https://user-images.githubusercontent.com/41321062/221360616-d6a7acba-46c9-4d2d-add2-50b832ae8684.png)

根据公式：
![image](https://user-images.githubusercontent.com/41321062/221360652-dc34a2f4-424f-4b66-a4f1-8329172655ef.png)
可得L = 248452


当交易进行后，价格从a点滑倒c点，如图，橙色为a点情况，蓝色为c点情况。
 ![image](https://user-images.githubusercontent.com/41321062/221360914-ac6cffa7-37a9-4dbd-8352-b43d55310637.png)

在a点：
(Xv+1000)*Yv=248452^2
Yv/(Xv+1000)=2000
可得：Xv=4555.56，Yv=11111120

在c点：
(Xv+1000-∆x)(Yv+100000)=248452^2
代入Xv, Yv后，可得：∆x=49.58，因此，用户可换得49.58个ETH，对应平均交易价格约2017 DAI/ETH，若认为平均成交价是初始价格和最终价格中点的话，则滑点应为2*（2017-2000）=34。这基本是符合预期的。

#### 交易费
交易者交易时，需要收取交易费。交易费率由社区投票决定。默认为0.1%。
产生的交易费会被分配给LP和治理币EASY的持有者。其中LP分得70%，EASY持有者分得30%。该比例可由社区投票修改。

#### 治理代币EASY

发行治理代币EASY，该代币总供应量限制为10亿枚。其中创始和运营团队获得预分配的1千万枚，分4年解冻；其他代币需在LP提供流动性，或交易者参与交易时挖出。提供流动性和参与交易挖出的EASY会随着TVL变高而降低。例如：
当TVL小于等于5000万USD时，每提供1USD的流动性，可获得1EASY；或每发生价值100 USD的交易时，可获得1EASY。当TVL位于5000万USD至5亿USD间时，可获得的EASY与前面相比减半。其他区间待定。

EASY持有者可通过投票决定EasyDEX的各种参数，如对交易费的分配比例；某个资金池的滑点计算转换阈值；某个资金池的滑点相关设置等。


