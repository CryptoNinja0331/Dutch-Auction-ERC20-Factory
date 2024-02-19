// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const hre = require("hardhat");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { assert } = require("console");
const { BigNumber } = require("ethers");

async function main() {
  [owner, addr1, addr2] = await ethers.getSigners();          
  const Token = await ethers.getContractFactory('Token', owner);
  token1 = await Token.deploy();

  DutchAuction = await ethers.getContractFactory('DutchAuction', owner);
  auctionContract = await DutchAuction.deploy();
  console.log(auctionContract.address);
  await auctionContract.deployed();

  await token1.connect(owner).approve(auctionContract.address, 1000);
    
  await auctionContract.connect(owner).createAuction(
    Math.floor(Date.now() / 1000 + 3600),
    ethers.utils.parseEther("1"),
    ethers.utils.parseEther("0.5"),
    500,
    token1.address
  );
  console.log((await auctionContract.currentPrice(1)).toString());
  await ethers.provider.send('evm_increaseTime', [1800]);
  await ethers.provider.send('evm_mine');
  console.log((await auctionContract.currentPrice(1)).toString());
  await ethers.provider.send('evm_increaseTime', [900]);
  await ethers.provider.send('evm_mine');
  console.log((await auctionContract.currentPrice(1)).toString());
  await ethers.provider.send('evm_increaseTime', [900]);
  await ethers.provider.send('evm_mine');
  console.log((await auctionContract.currentPrice(1)).toString());
  

  // const sevenDays = 60 * 60;

  // const blockNumBefore = await ethers.provider.getBlockNumber();
  // const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  // const timestampBefore = blockBefore.timestamp;
  // const priceBefore = (await auctionContract.currentPrice(1)).toString();
  // console.log(priceBefore);
  // console.log((await auctionContract.currentPrice(1)).toString());
  // console.log((await auctionContract.getAuctionID()).toString());

  // await ethers.provider.send('evm_increaseTime', [sevenDays]);
  // await ethers.provider.send('evm_mine');

  // console.log((await auctionContract.currentPrice(1)).toString());

  // const blockNumAfter = await ethers.provider.getBlockNumber();
  // const blockAfter = await ethers.provider.getBlock(blockNumAfter);
  // const timestampAfter = blockAfter.timestamp;
  // const priceAfter = (await auctionContract.currentPrice(1)).toString();
  // console.log(priceAfter);


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
