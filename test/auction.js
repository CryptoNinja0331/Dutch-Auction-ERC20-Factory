const { expect } = require("chai");
const { ethers } = require("hardhat");
const { assert } = require("console");
const { token } = require("@project-serum/anchor/dist/cjs/utils");

const transformAuctionDetails = (auctionData) => {
  return {
    
    startDate: auctionData.startDate.toNumber(),
    endDate: auctionData.endDate.toNumber(),
    startPrice: ethers.utils.formatEther(auctionData.startPrice),
    reservePrice: ethers.utils.formatEther(auctionData.reservePrice),
    biddingPrice: ethers.utils.formatEther(auctionData.biddingPrice),
    totalTokens: auctionData.totalTokens.toNumber(),
    remainingTokens: auctionData.remainingTokens.toNumber(),
    totalBids: auctionData.totalBids.toNumber(),
    totalAmount: ethers.utils.formatEther(auctionData.totalAmount),
    token: auctionData.token.toString(),
    auctionComplete: auctionData.auctionComplete,
         
  };
};

// AUCTION 1 - FEW TOKENS & LONG ENDDATE- SO ALL TOKENS ARE SOLD BEFORE ENDDATE
// AUCTION 2 - MANY TOKENS & SHORT ENDDATE- SO THIS AUCTION ENDS BEFORE ALL TOKENS ARE SOLD
// AUCTION 3 IS ADDED TO SHOW THAT THIS CONTRACT CAN HANDLE MULTIPLE LIVE AUCTIONS SIMULTANEOUSLY
// AUCTION 3 - MANY TOKENS & LONG ENDDATE-- THIS AUCTION STARTS ALONG WITH AUCTION 2, THIS AUCTION REMAINS LIVE THROUGHOUT AUCTION 2 LIFETIME. AND, IT ENDS AFTER ALL TOKENS ARE SOLD.  

describe("DutchAuction Unit Test", function () {

  
  before(async function () {

    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();          
    const Token = await ethers.getContractFactory('Token', owner);
    token1 = await Token.deploy();
    decimals = await token1.decimals();
    
    DutchAuction = await ethers.getContractFactory('DutchAuction', owner);
    auctionContract = await DutchAuction.deploy();
    await auctionContract.deployed();

  });

  describe("Minting Local Tokens", function () { 

    it("Should mint tokens & check owner balance", async function () { 
      
      ownerBalance = (await token1.balanceOf(owner.address)) / 10**decimals; 
      expect(ownerBalance).to.be.equal(1000000);
      
    });

  });
  
  describe("CREATE AUCTION_1 ()", function () { 

    it("Should create auction with the approved tokens", async function () {

      // first auction has limited tokens and long enddate
      await token1.connect(owner).approve(auctionContract.address, ethers.utils.parseEther("20"));
      const tx = await auctionContract.connect(owner).createAuction(
        Math.floor(Date.now() / 1000 + 3600),
        ethers.utils.parseEther("1"),
        ethers.utils.parseEther("0.5"),
        20,
        token1.address
      );
      const rc = await tx.wait(); // 0ms, as tx is already confirmed
      const event = rc.events.find(event => event.event === 'AuctionCreated');
      const [auctionID, totalTokens, tokenAddress] = event.args;
      
      
      let ContractAuctionID = (await auctionContract.auctionID()).toNumber();
      expect(auctionID).to.be.equal(ContractAuctionID);
      expect(totalTokens).to.be.equal(20);
      expect(tokenAddress.toString()).to.be.equal(token1.address);

    });

    it("Should check if created auctions are live", async function () { 
      
      // AUCTION1
      let auctionDetails = await auctionContract.auctionDetails(1);
      let auctionComplete = transformAuctionDetails(auctionDetails).auctionComplete;  
      expect(auctionComplete).to.be.false;
      
    });

    it("Should check auction details", async function () { 
      // AUCTION1
      let auctionDetails = await auctionContract.auctionDetails(1);
      let result = transformAuctionDetails(auctionDetails);
      
      expect(result.endDate - result.startDate).to.be.at.most(3600);
      expect(result.startPrice).to.be.equal('1.0');
      expect(result.biddingPrice).to.be.equal('1.0');
      expect(result.reservePrice).to.be.equal('0.5');
      
      
      expect(result.totalBids).to.be.equal(0);
      expect(result.totalAmount).to.be.equal('0.0');
      expect(result.token).to.be.equal(token1.address);
      expect(result.auctionComplete).to.be.false;

    });

    it("Should check auction owner & auction ID", async function () { 

      let auctionID = (await auctionContract.auctionOwner(owner.address)).toNumber();
      expect(auctionID).to.equal(1);

      let auctionID3 = (await auctionContract.auctionOwner(addr2.address)).toNumber();
      expect(auctionID3).to.equal(0);
      
    });

    it("Should check owner & contract balance for erc20 tokens", async function () { 
      
      let contractTokenBalance = (await token1.balanceOf(auctionContract.address)) / 10**decimals; 
      let ownerNewBalance = (await token1.balanceOf(owner.address)) / 10**decimals; 
      expect(ownerBalance - contractTokenBalance).to.be.equal(ownerNewBalance);

    });

  });

  describe("CREATE 2 BIDS FOR AUCTION_1 ()", function () { 

    it("Should check if only nonAuctionOwners can access this bid", async function () { 

      await expect(auctionContract.connect(owner).createBid(1, 10)).to.be.revertedWith('Auction Owner cannot make a bid');

    });

    it("Should check if auction is live", async function () { 

      expect(transformAuctionDetails(await auctionContract.connect(owner).auctionDetails(1)).auctionComplete).to.be.false;

    });

    it("Should check if bidder has any previous bids in this auction", async function () { 
      
      expect(await auctionContract.reservedTokens(addr1.address,1)).to.be.equal(0);

    });

    //check if auction has sufficient tokens for bidder
    it("Should check if auction has sufficient tokens for bidder", async function () { 

      expect(transformAuctionDetails(await auctionContract.auctionDetails(1)).remainingTokens).to.not.be.equal(0);

    });

    it("Should create 1st bid in auction 1 with adddress 1 & check the created bid details", async function () {
      
      let price = parseFloat(ethers.utils.formatEther(await auctionContract.currentPrice(1)));
      let requestTokens = 10;
      let cost = (price * requestTokens).toString();
      
      let auctionDetailsBefore = await auctionContract.auctionDetails(1);
      let auctionDataBefore = transformAuctionDetails(auctionDetailsBefore);
      let totalAmountBefore = parseFloat(auctionDataBefore.totalAmount);
      
      await auctionContract.connect(addr1).createBid(1, requestTokens, {value: ethers.utils.parseEther(cost)});
      
      let auctionDetails = await auctionContract.auctionDetails(1);
      let auctionData = transformAuctionDetails(auctionDetails);
      let totalTokens = auctionData.totalTokens;
      let remainingTokens = auctionData.remainingTokens;
      let totalAmount = parseFloat(auctionData.totalAmount);
      let reservedTokens = parseInt(await auctionContract.reservedTokens(addr1.address,1));
      let moneyDeposited = parseFloat(ethers.utils.formatEther(await auctionContract.moneyDeposited(addr1.address,1)));
      
      expect(moneyDeposited.toString()).to.be.equal(cost);
      expect(totalTokens - 10).to.be.equal(remainingTokens);
      expect(moneyDeposited.toFixed(5)).to.be.equal((totalAmount - totalAmountBefore).toFixed(5));
      expect(reservedTokens).to.be.equal(requestTokens);

    });

    it("Should create 2nd Bid in Auction 1 with address 2 after increasing time & check bid details", async function () { 

      // INCREASE TIME AND MAKE BIDS
      await ethers.provider.send('evm_increaseTime', [1800]);
      await ethers.provider.send('evm_mine');

      let price = parseFloat(ethers.utils.formatEther(await auctionContract.currentPrice(1)));
      let requestTokens = 10;
      let cost = (price * requestTokens).toString();
      
      let auctionDetailsBefore = await auctionContract.auctionDetails(1);
      let auctionDataBefore = transformAuctionDetails(auctionDetailsBefore);
      let totalAmountBefore = parseFloat(auctionDataBefore.totalAmount);
      
      await auctionContract.connect(addr2).createBid(1, requestTokens, {value: ethers.utils.parseEther(cost)});
      
      let auctionDetails = await auctionContract.auctionDetails(1);
      let auctionData = transformAuctionDetails(auctionDetails);
      let totalTokens = auctionData.totalTokens;
      let remainingTokens = auctionData.remainingTokens;
      let totalAmount = parseFloat(auctionData.totalAmount);
      let reservedTokens = parseInt(await auctionContract.reservedTokens(addr2.address,1));
      let moneyDeposited = parseFloat(ethers.utils.formatEther(await auctionContract.moneyDeposited(addr2.address,1)));
      
      expect(moneyDeposited.toString()).to.be.equal(cost);
      expect(totalTokens - 20).to.be.equal(remainingTokens);
      expect(moneyDeposited.toFixed(5)).to.be.equal((totalAmount - totalAmountBefore).toFixed(5));
      expect(reservedTokens).to.be.equal(requestTokens);

    });

    it("Should check bidIDList & biddersList details", async function () { 
     
      let bidID = (await auctionContract.bidIDList(addr1.address,1)).toNumber();
      let bidder = await auctionContract.biddersList(1,bidID);
      expect(bidder).to.be.equal(addr1.address);

      let bidID2 = (await auctionContract.bidIDList(addr2.address,1)).toNumber();
      let bidder2 = await auctionContract.biddersList(1,bidID2);
      expect(bidder2).to.be.equal(addr2.address);

    });

  });

  describe("END AUCTION_1 ()", function () { 

    it("Should only be accessed by Auction Owners", async function () { 

      await expect(auctionContract.connect(addr1).endAuction(1)).to.be.revertedWith('You are not the Auction Owner');

    });

    it("Should check if auction is live", async function () { 

      expect(transformAuctionDetails(await auctionContract.connect(owner).auctionDetails(1)).auctionComplete).to.be.false;

    });

    it("Should end auction & check if all funds were distributed", async function () { 
      
      // ETH BALANCE BEFORE
      const ownerBalanceBefore = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(owner.address)));
      const addr1BalanceBefore = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr1.address)));
      const addr2BalanceBefore = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr2.address)));
      
      // ERC20 BALANCE BEFORE
      let contractTokenBalanceBefore = (await token1.balanceOf(auctionContract.address)) / 10**decimals; 
      let addr1TokenBalanceBefore = (await token1.balanceOf(addr1.address)) / 10**decimals; 
      let addr2TokenBalanceBefore = (await token1.balanceOf(addr2.address)) / 10**decimals;        

      await auctionContract.connect(owner).endAuction(1);

      // ETH BALANCE AFTER
      const ownerBalanceAfter = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(owner.address)));
      const addr1BalanceAfter = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr1.address)));
      const addr2BalanceAfter = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr2.address)));
      
      // ERC20 BALANCE AFTER 
      let contractTokenBalanceAfter = (await token1.balanceOf(auctionContract.address)) / 10**decimals; 
      let addr1TokenBalanceAfter = (await token1.balanceOf(addr1.address)) / 10**decimals; 
      let addr2TokenBalanceAfter = (await token1.balanceOf(addr2.address)) / 10**decimals; 

      // CHECKING ETH BALANCE 
      expect(ownerBalanceAfter).to.be.greaterThanOrEqual(ownerBalanceBefore);
      expect(addr1BalanceAfter).to.be.greaterThanOrEqual(addr1BalanceBefore);
      expect(addr2BalanceAfter).to.be.greaterThanOrEqual(addr2BalanceBefore);

      // CHECKING ERC20 BALANCE
      expect(contractTokenBalanceAfter).to.be.lessThan(contractTokenBalanceBefore);
      expect(addr1TokenBalanceAfter).to.be.greaterThan(addr1TokenBalanceBefore);
      expect(addr2TokenBalanceAfter).to.be.greaterThan(addr2TokenBalanceBefore);
      
      // CHECKING COMPLETED AUCTION DETAILS
      let auctionDetails = await auctionContract.auctionDetails(1);
      let auctionData = transformAuctionDetails(auctionDetails);  
      expect(auctionData.remainingTokens).to.be.equal(0);
      expect(auctionData.totalAmount).to.be.equal('0.0');
      // CHECKING IF THE AUCTION IS COMPLETED
      expect(auctionData.auctionComplete).to.be.true;
      
      

    });

  });  

  describe("CREATE AUCTION_2 ()", function () { 

    it("Should create auction with the approved tokens", async function () {
    
      // second auction has many tokens and short enddate
      // second auction has unsold tokens after enddate
      depositTokens = 80;
      ownerBalance = (await token1.balanceOf(owner.address)) / 10**decimals; 
      await token1.connect(owner).transfer(addr3.address, ethers.utils.parseEther(depositTokens.toString()));
      await token1.connect(addr3).approve(auctionContract.address, ethers.utils.parseEther(depositTokens.toString()));
      await auctionContract.connect(addr3).createAuction(
        // 1800 is added because we increased time inside the blockchain by 1800s during bidding of Auction 1
        Math.floor(Date.now() / 1000 + 1800 + 1800),
        ethers.utils.parseEther("1"),
        ethers.utils.parseEther("0.5"),
        80,
        token1.address
      );
      
    });

    it("Should check if created auctions are live", async function () { 
      
      // AUCTION2
      let auctionDetails2 = await auctionContract.auctionDetails(2);
      let auctionComplete2 = transformAuctionDetails(auctionDetails2).auctionComplete;  
      expect(auctionComplete2).to.be.false;

    });

    it("Should check auction details", async function () { 
      
      // AUCTION2
      let auctionDetails2 = await auctionContract.auctionDetails(2);
      let result2 = transformAuctionDetails(auctionDetails2);
      
      expect(result2.endDate - result2.startDate).to.be.at.most(1800);
      expect(result2.startPrice).to.be.equal('1.0');
      expect(result2.biddingPrice).to.be.equal('1.0');
      expect(result2.reservePrice).to.be.equal('0.5');
      
      expect(result2.totalBids).to.be.equal(0);
      expect(result2.totalAmount).to.be.equal('0.0');
      expect(result2.token).to.be.equal(token1.address);
      expect(result2.auctionComplete).to.be.false;

    });

    it("Should check auction owner & auction ID", async function () { 

      let auctionID2 = (await auctionContract.auctionOwner(addr3.address)).toNumber();
      expect(auctionID2).to.equal(2);

      let auctionID3 = (await auctionContract.auctionOwner(addr2.address)).toNumber();
      expect(auctionID3).to.equal(0);
      
    });

    
    it("Should check owner & contract balance for erc20 tokens", async function () { 
      
      // let contractTokenBalance = (await token1.balanceOf(auctionContract.address)) / 10**decimals; 
      let ownerNewBalance = (await token1.balanceOf(owner.address)) / 10**decimals; 
      expect(ownerBalance - depositTokens).to.be.equal(ownerNewBalance);

    });

  });

  describe("CREATE AUCTION_3 ()", function () { 

    it("Should create auction with the approved tokens", async function () {
      // AUCTION 3 IS ADDED TO SHOW THAT THIS CONTRACT CAN HANDLE MULTIPLE LIVE AUCTIONS SIMULTANEOUSLY
      // third auction has many tokens and long enddate
      
      ownerBalance = (await token1.balanceOf(owner.address)) / 10**decimals; 
      depositTokens = 100;
      await token1.connect(owner).transfer(addr4.address, ethers.utils.parseEther(depositTokens.toString()));
      await token1.connect(addr4).approve(auctionContract.address, ethers.utils.parseEther(depositTokens.toString()));
      await auctionContract.connect(addr4).createAuction(
        // 1800 is added because we increased time inside the blockchain by 1800s during bidding of Auction 1
        Math.floor(Date.now() / 1000 + 1800 + 7200),
        ethers.utils.parseEther("1"),
        ethers.utils.parseEther("0.5"),
        depositTokens,
        token1.address
      );
      
    });

    it("Should check if created auctions are live", async function () { 
      
      // AUCTION3
      let auctionDetails3 = await auctionContract.auctionDetails(3);
      let auctionComplete3 = transformAuctionDetails(auctionDetails3).auctionComplete;  
      expect(auctionComplete3).to.be.false;

    });

    it("Should check auction details", async function () { 
      
      // AUCTION2
      let auctionDetails3 = await auctionContract.auctionDetails(3);
      let result3 = transformAuctionDetails(auctionDetails3);
      
      expect(result3.endDate - result3.startDate).to.be.at.most(7200);
      expect(result3.startPrice).to.be.equal('1.0');
      expect(result3.biddingPrice).to.be.equal('1.0');
      expect(result3.reservePrice).to.be.equal('0.5');
      
      expect(result3.totalBids).to.be.equal(0);
      expect(result3.totalAmount).to.be.equal('0.0');
      expect(result3.token).to.be.equal(token1.address);
      expect(result3.auctionComplete).to.be.false;

    });

    it("Should check auction owner & auction ID", async function () { 

      let auctionID3 = (await auctionContract.auctionOwner(addr4.address)).toNumber();
      expect(auctionID3).to.equal(3);

      let auctionID4 = (await auctionContract.auctionOwner(addr2.address)).toNumber();
      expect(auctionID4).to.equal(0);
      
    });

    
    it("Should check owner & contract balance for erc20 tokens", async function () { 
      
      // let contractTokenBalance = (await token1.balanceOf(auctionContract.address)) / 10**decimals; 
      let ownerNewBalance = (await token1.balanceOf(owner.address)) / 10**decimals; 
      // console.log(ownerNewBalance);
      expect(ownerBalance - depositTokens).to.be.equal(ownerNewBalance);

    });

  });

  describe("CREATE FIRST BID OF AUCTION_3 ()", function () { 


    it("Should check if only nonAuctionOwners can access this bid", async function () { 

      await expect(auctionContract.connect(addr4).createBid(3, 10)).to.be.revertedWith('Auction Owner cannot make a bid');

    });

    it("Should check if auction is live", async function () { 

      expect(transformAuctionDetails(await auctionContract.connect(addr4).auctionDetails(3)).auctionComplete).to.be.false;

    });

    it("Should check if bidder has any previous bids in this auction", async function () { 
      
      expect(await auctionContract.reservedTokens(addr1.address,3)).to.be.equal(0);

    });

    it("Should check if auction has sufficient tokens for bidder", async function () { 

      expect(transformAuctionDetails(await auctionContract.auctionDetails(3)).remainingTokens).to.not.be.equal(0);

    });

    it("Should create 1st bid in auction 3 with adddress 1 & check the created bid details", async function () {
      
      let price = parseFloat(ethers.utils.formatEther(await auctionContract.currentPrice(3)));
      let requestTokens = 25;
      let cost = (price * requestTokens).toString();
      
      let auctionDetailsBefore = await auctionContract.auctionDetails(3);
      let auctionDataBefore = transformAuctionDetails(auctionDetailsBefore);
      let totalAmountBefore = parseFloat(auctionDataBefore.totalAmount);
      
      await auctionContract.connect(addr1).createBid(3, requestTokens, {value: ethers.utils.parseEther(cost)});
      
      let auctionDetails = await auctionContract.auctionDetails(3);
      let auctionData = transformAuctionDetails(auctionDetails);
      let totalTokens = auctionData.totalTokens;
      let remainingTokens = auctionData.remainingTokens;
      let totalAmount = parseFloat(auctionData.totalAmount);
      let reservedTokens = parseInt(await auctionContract.reservedTokens(addr1.address,3));
      let moneyDeposited = parseFloat(ethers.utils.formatEther(await auctionContract.moneyDeposited(addr1.address,3)));
      
      expect(moneyDeposited.toString()).to.be.equal(cost);
      expect(totalTokens - 25).to.be.equal(remainingTokens);
      expect(moneyDeposited.toFixed(5)).to.be.equal((totalAmount - totalAmountBefore).toFixed(5));
      expect(reservedTokens).to.be.equal(requestTokens);

    });


  });

  describe("CREATE 2 BIDS AUCTION_2 ()", function () { 

    it("Should check if only nonAuctionOwners can access this bid", async function () { 

      await expect(auctionContract.connect(addr3).createBid(2, 10)).to.be.revertedWith('Auction Owner cannot make a bid');

    });

    it("Should check if auction is live", async function () { 

      expect(transformAuctionDetails(await auctionContract.connect(addr3).auctionDetails(2)).auctionComplete).to.be.false;

    });

    it("Should check if bidder has any previous bids in this auction", async function () { 
      
      expect(await auctionContract.reservedTokens(addr1.address,2)).to.be.equal(0);

    });

    //check if auction has sufficient tokens for bidder
    it("Should check if auction has sufficient tokens for bidder", async function () { 

      expect(transformAuctionDetails(await auctionContract.auctionDetails(2)).remainingTokens).to.not.be.equal(0);

    });

    it("Should create 1st bid in auction 2 with adddress 1 & check the created bid details", async function () {
      
      let price = parseFloat(ethers.utils.formatEther(await auctionContract.currentPrice(2)));
      let requestTokens = 25;
      let cost = (price * requestTokens).toString();
      
      let auctionDetailsBefore = await auctionContract.auctionDetails(2);
      let auctionDataBefore = transformAuctionDetails(auctionDetailsBefore);
      let totalAmountBefore = parseFloat(auctionDataBefore.totalAmount);
      
      await auctionContract.connect(addr1).createBid(2, requestTokens, {value: ethers.utils.parseEther(cost)});
      
      let auctionDetails = await auctionContract.auctionDetails(2);
      let auctionData = transformAuctionDetails(auctionDetails);
      let totalTokens = auctionData.totalTokens;
      let remainingTokens = auctionData.remainingTokens;
      let totalAmount = parseFloat(auctionData.totalAmount);
      let reservedTokens = parseInt(await auctionContract.reservedTokens(addr1.address,2));
      let moneyDeposited = parseFloat(ethers.utils.formatEther(await auctionContract.moneyDeposited(addr1.address,2)));
      
      expect(moneyDeposited.toString()).to.be.equal(cost);
      expect(totalTokens - 25).to.be.equal(remainingTokens);
      expect(moneyDeposited.toFixed(5)).to.be.equal((totalAmount - totalAmountBefore).toFixed(5));
      expect(reservedTokens).to.be.equal(requestTokens);

    });

    it("Should create 2nd Bid in Auction 2 with address 2 after increasing time & check bid details", async function () { 

      // INCREASE TIME AND MAKE BIDS
      await ethers.provider.send('evm_increaseTime', [1800]);
      await ethers.provider.send('evm_mine');

      let price = parseFloat(ethers.utils.formatEther(await auctionContract.currentPrice(2)));
      let requestTokens = 25;
      let cost = (price * requestTokens).toString();
      
      let auctionDetailsBefore = await auctionContract.auctionDetails(2);
      let auctionDataBefore = transformAuctionDetails(auctionDetailsBefore);
      let totalAmountBefore = parseFloat(auctionDataBefore.totalAmount);
      
      await auctionContract.connect(addr2).createBid(2, requestTokens, {value: ethers.utils.parseEther(cost)});
      
      let auctionDetails = await auctionContract.auctionDetails(2);
      let auctionData = transformAuctionDetails(auctionDetails);
      let totalTokens = auctionData.totalTokens;
      let remainingTokens = auctionData.remainingTokens;
      let totalAmount = parseFloat(auctionData.totalAmount);
      let reservedTokens = parseInt(await auctionContract.reservedTokens(addr2.address,2));
      let moneyDeposited = parseFloat(ethers.utils.formatEther(await auctionContract.moneyDeposited(addr2.address,2)));
      
      expect(moneyDeposited.toString()).to.be.equal(cost);
      expect(totalTokens - 50).to.be.equal(remainingTokens);
      expect(moneyDeposited.toFixed(5)).to.be.equal((totalAmount - totalAmountBefore).toFixed(5));
      expect(reservedTokens).to.be.equal(requestTokens);

    });

    it("Should check bidIDList & biddersList details", async function () { 
     
      let bidID = (await auctionContract.bidIDList(addr1.address,1)).toNumber();
      let bidder = await auctionContract.biddersList(2,bidID);
      expect(bidder).to.be.equal(addr1.address);

      let bidID2 = (await auctionContract.bidIDList(addr2.address,1)).toNumber();
      let bidder2 = await auctionContract.biddersList(2,bidID2);
      expect(bidder2).to.be.equal(addr2.address);

    });

  });

  describe("CREATE SECOND BID OF AUCTION_3 ()", function () { 


    it("Should check if only nonAuctionOwners can access this bid", async function () { 

      await expect(auctionContract.connect(addr4).createBid(3, 10)).to.be.revertedWith('Auction Owner cannot make a bid');

    });

    it("Should check if auction is live", async function () { 

      expect(transformAuctionDetails(await auctionContract.connect(addr4).auctionDetails(3)).auctionComplete).to.be.false;

    });

    it("Should check if bidder has any previous bids in this auction", async function () { 
      
      expect(await auctionContract.reservedTokens(addr2.address,3)).to.be.equal(0);

    });

    it("Should check if auction has sufficient tokens for bidder", async function () { 

      expect(transformAuctionDetails(await auctionContract.auctionDetails(3)).remainingTokens).to.not.be.equal(0);

    });

    it("Should create 2nd bid in auction 3 with adddress 2 & check the created bid details", async function () {
      
      let price = parseFloat(ethers.utils.formatEther(await auctionContract.currentPrice(3)));
      let requestTokens = 75;
      let cost = (price * requestTokens).toString();
      
      let auctionDetailsBefore = await auctionContract.auctionDetails(3);
      let auctionDataBefore = transformAuctionDetails(auctionDetailsBefore);
      let totalAmountBefore = parseFloat(auctionDataBefore.totalAmount);
      
      await auctionContract.connect(addr2).createBid(3, requestTokens, {value: ethers.utils.parseEther(cost)});
      
      let auctionDetails = await auctionContract.auctionDetails(3);
      let auctionData = transformAuctionDetails(auctionDetails);
      let totalTokens = auctionData.totalTokens;
      let remainingTokens = auctionData.remainingTokens;
      let totalAmount = parseFloat(auctionData.totalAmount);
      let reservedTokens = parseInt(await auctionContract.reservedTokens(addr2.address,3));
      let moneyDeposited = parseFloat(ethers.utils.formatEther(await auctionContract.moneyDeposited(addr2.address,3)));
      
      expect(moneyDeposited.toString()).to.be.equal(cost);
      expect(totalTokens - 100).to.be.equal(remainingTokens);
      expect(moneyDeposited.toFixed(5)).to.be.equal((totalAmount - totalAmountBefore).toFixed(5));
      expect(reservedTokens).to.be.equal(requestTokens);

    });


  });

  describe("END AUCTION_2 ()", function () { 

    it("Should only be accessed by Auction Owners", async function () { 

      await expect(auctionContract.connect(addr1).endAuction(2)).to.be.revertedWith('You are not the Auction Owner');

    });

    it("Should check if auction is live", async function () { 

      expect(transformAuctionDetails(await auctionContract.connect(owner).auctionDetails(2)).auctionComplete).to.be.false;

    });

    it("Should end auction & check if all funds were distributed", async function () { 
      
      // ETH BALANCE BEFORE
      const ownerBalanceBefore = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr3.address)));
      const addr1BalanceBefore = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr1.address)));
      const addr2BalanceBefore = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr2.address)));
      
      // ERC20 BALANCE BEFORE
      let contractTokenBalanceBefore = (await token1.balanceOf(auctionContract.address)) / 10**decimals; 
      let addr1TokenBalanceBefore = (await token1.balanceOf(addr1.address)) / 10**decimals; 
      let addr2TokenBalanceBefore = (await token1.balanceOf(addr2.address)) / 10**decimals;        
      let ownerTokenBalanceBefore = (await token1.balanceOf(addr3.address)) / 10**decimals; 
      
      // ENDING THE AUCTION
      await auctionContract.connect(addr3).endAuction(2);

      // ETH BALANCE AFTER
      const ownerBalanceAfter = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr3.address)));
      const addr1BalanceAfter = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr1.address)));
      const addr2BalanceAfter = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr2.address)));
      
      // ERC20 BALANCE AFTER 
      let contractTokenBalanceAfter = (await token1.balanceOf(auctionContract.address)) / 10**decimals; 
      let addr1TokenBalanceAfter = (await token1.balanceOf(addr1.address)) / 10**decimals; 
      let addr2TokenBalanceAfter = (await token1.balanceOf(addr2.address)) / 10**decimals; 
      let ownerTokenBalanceAfter = (await token1.balanceOf(addr3.address)) / 10**decimals; 
      
      // CHECKING ETH BALANCE 
      expect(ownerBalanceAfter).to.be.greaterThanOrEqual(ownerBalanceBefore);
      expect(addr1BalanceAfter).to.be.greaterThanOrEqual(addr1BalanceBefore);
      expect(addr2BalanceAfter).to.be.greaterThanOrEqual(addr2BalanceBefore);

      // CHECKING ERC20 BALANCE
      // UNSOLD ERC20 TOKENS WERE SENT BACK TO AUCTION OWNER
      expect(contractTokenBalanceAfter).to.be.lessThan(contractTokenBalanceBefore);
      expect(addr1TokenBalanceAfter).to.be.greaterThan(addr1TokenBalanceBefore);
      expect(addr2TokenBalanceAfter).to.be.greaterThan(addr2TokenBalanceBefore);
      expect(ownerTokenBalanceAfter).to.be.greaterThan(ownerTokenBalanceBefore);
      
      // CHECKING COMPLETED AUCTION DETAILS
      let auctionDetails = await auctionContract.auctionDetails(2);
      let auctionData = transformAuctionDetails(auctionDetails);  
      expect(auctionData.remainingTokens).to.be.equal(0);
      expect(auctionData.totalAmount).to.be.equal('0.0');
      // CHECKING IF THE AUCTION IS COMPLETED
      expect(auctionData.auctionComplete).to.be.true;
      
    });

    

  });  

  describe("END AUCTION_3 ()", function () { 

    it("Should only be accessed by Auction Owners", async function () { 

      await expect(auctionContract.connect(addr1).endAuction(3)).to.be.revertedWith('You are not the Auction Owner');

    });

    it("Should check if auction is live", async function () { 

      expect(transformAuctionDetails(await auctionContract.connect(owner).auctionDetails(3)).auctionComplete).to.be.false;

    });

    it("Should end auction & check if all funds were distributed", async function () { 
      
      // ETH BALANCE BEFORE
      const ownerBalanceBefore = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr4.address)));
      const addr1BalanceBefore = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr1.address)));
      const addr2BalanceBefore = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr2.address)));
      
      // ERC20 BALANCE BEFORE
      let contractTokenBalanceBefore = (await token1.balanceOf(auctionContract.address)) / 10**decimals; 
      let addr1TokenBalanceBefore = (await token1.balanceOf(addr1.address)) / 10**decimals; 
      let addr2TokenBalanceBefore = (await token1.balanceOf(addr2.address)) / 10**decimals;        
      let ownerTokenBalanceBefore = (await token1.balanceOf(addr4.address)) / 10**decimals; 
      
      // ENDING THE AUCTION 
      await expect(auctionContract.connect(addr4).endAuction(3)).to.not.be.reverted;



      // ETH BALANCE AFTER
      const ownerBalanceAfter = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr4.address)));
      const addr1BalanceAfter = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr1.address)));
      const addr2BalanceAfter = parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(addr2.address)));
      
      // ERC20 BALANCE AFTER 
      let contractTokenBalanceAfter = (await token1.balanceOf(auctionContract.address)) / 10**decimals; 
      let addr1TokenBalanceAfter = (await token1.balanceOf(addr1.address)) / 10**decimals; 
      let addr2TokenBalanceAfter = (await token1.balanceOf(addr2.address)) / 10**decimals; 
      let ownerTokenBalanceAfter = (await token1.balanceOf(addr4.address)) / 10**decimals; 
      
      // CHECKING ETH BALANCE 
      expect(ownerBalanceAfter).to.be.greaterThanOrEqual(ownerBalanceBefore);
      expect(addr1BalanceAfter).to.be.greaterThanOrEqual(addr1BalanceBefore);
      expect(addr2BalanceAfter).to.be.greaterThanOrEqual(addr2BalanceBefore);

      // CHECKING ERC20 BALANCE
      // UNSOLD ERC20 TOKENS WERE SENT BACK TO AUCTION OWNER
      expect(contractTokenBalanceAfter).to.be.lessThan(contractTokenBalanceBefore);
      expect(addr1TokenBalanceAfter).to.be.greaterThan(addr1TokenBalanceBefore);
      expect(addr2TokenBalanceAfter).to.be.greaterThan(addr2TokenBalanceBefore);
      expect(ownerTokenBalanceAfter).to.be.equal(ownerTokenBalanceBefore);
      
      // CHECKING COMPLETED AUCTION DETAILS
      let auctionDetails = await auctionContract.auctionDetails(2);
      let auctionData = transformAuctionDetails(auctionDetails);  
      expect(auctionData.remainingTokens).to.be.equal(0);
      expect(auctionData.totalAmount).to.be.equal('0.0');
      // CHECKING IF THE AUCTION IS COMPLETED
      expect(auctionData.auctionComplete).to.be.true;
      
    });

    

  });  

});