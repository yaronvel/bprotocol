const Web3 = require("web3");
const { ctokenAbi, compoundAbi } = require("./constants");
const { default: BigNumber } = require("bignumber.js");
const url = "wss://mainnet.infura.io/ws/v3/4f3624523ff64420bfbfc685374a5962";
const web3 = new Web3(new Web3.providers.WebsocketProvider(url));

const cETH = new web3.eth.Contract(
  ctokenAbi,
  "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5"
);
const cDAI = new web3.eth.Contract(
  ctokenAbi,
  "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643"
);

const compound = new web3.eth.Contract(
  compoundAbi,
  "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B"
);

// ctoken is either cETH or cDAI.
// returns the balance, scaled by 1e8
function getBalance(ctoken, user) {
  return ctoken.methods.balanceOf(user).call();
}

function getExchangeRate(ctoken) {
  return ctoken.methods.exchangeRateCurrent().call();
}

// RETURN : The current exchange rate as an unsigned integer, scaled by 1e18.
function getExchangeRate(ctoken) {
  return ctoken.methods.exchangeRateCurrent().call();
}

// Tuple of values (isListed, collateralFactorMantissa); isListed represents whether the comptroller recognizes this cToken;
// collateralFactorMantissa, scaled by 1e18, is multiplied by a supply balance to determine how much value can be borrowed.
function getMarket(ctoken) {
  return compound.methods.markets(ctoken.options.address).call();
}

//RETURN : The user's current borrow balance (with interest) in units of the underlying asset.
function getDebt(ctoken, user) {
  return ctoken.methods.borrowBalanceCurrent(user).call();
}

////////////////////////////////////////////////////////////////////////////////
// exercise (1)
////////////////////////////////////////////////////////////////////////////////

// User has a balance of cETH and a debt of cDAI. The goal is to calculate liquidation price
// where:
//    User collateral value is:
//      balance * exchangeRate * collateralFactor
//    User debt is:
//      debt * price
//
// liquidation price is the price for which debt >= collateral value.
//
// Note:
// 1) all above functions returns a promise
// 2) the functions return an integer, not a float, and in different scale. For example a scale of 1e8 means that 1.1 will be represented as 110000000
// 3) javascript cannot directly handle numbers at the scale of 1e18.
// 4) collateralFactor can be obtained from getMarket function

// please implement, as a web page, a widget that takes as input user address and returns the liquidation price
// You can use address "0x14f92271f8B8B531Fc3C544B81f480c8aFd5fD58" to test your implementation

////////////////////////////////////////////////////////////////////////////////
// exercise (2)
////////////////////////////////////////////////////////////////////////////////

// this function returns an array where each element is of the form of
/*
/*
{ address: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  blockHash:
   '0x25a911ca7a543277f240e2181cc030bd8ac598eee176e09da255711788498b4e',
  blockNumber: 10412659,
  logIndex: 165,
  removed: false,
  transactionHash:
   '0x7b716484fa6fc1e111ad2b1d0586e2584acde8f65397cc1121b839926e9a93ba',
  transactionIndex: 86,
  id: 'log_698a95ce',
  returnValues:
   Result {
     '0': '0x89F4e4bE0A78a63F12bE3094d35Fb58430D10A86',
     '1': '400000000000000000000',
     '2': '1998720108608',
     minter: '0x89F4e4bE0A78a63F12bE3094d35Fb58430D10A86',
     mintAmount: '400000000000000000000',
     mintTokens: '1998720108608' },
  event: 'Mint',
  signature:
   '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f',
  raw:
   { data:
      '0x00000000000000000000000089f4e4be0a78a63f12be3094d35fb58430d10a86000000000000000000000000000000000000000000000015af1d78b58c400000000000000000000000000000000000000000000000000000000001d15d008840',
     topics:
      [ '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f' ] } }
*/
function getCEthMintEvents(startBlock, endBlock) {
  return cETH.getPastEvents("Mint", {
    fromBlock: startBlock,
    toBlock: endBlock,
  });
}

const startBlock = 7710758;
const endBlock = 8710758;

let currentStartBlock = startBlock;
let currentEndBlock = startBlock + 10;
let maxMintData = { mintAmount: 0, address: undefined };

let stop = false;
while (currentEndBlock <= endBlock && stop === false) {
  const promises = Array(10)
    .fill(null)
    .map((_, idx) => {
      return getCEthMintEvents(currentStartBlock, currentEndBlock + idx).then(
        (result) => {
          return getMaxMintData(result);
        }
      );
    });

  Promise.all(promises).then((results) => {
    results.forEach((result) => {
      const max = BigNumber.maximum(maxMintData.mintAmount, result.mintAmount);
      maxMintData = max === result.mintAmount ? result : maxMintData;
    });
  });

  stop = true;

  if (endBlock - currentEndBlock >= 10) {
    currentEndBlock += 10;
  } else {
    currentEndBlock += endBlock - currentEndBlock;
  }
}

const getMaxMintData = (arr) => {
  return arr.reduce(
    (obj, { returnValues, address }) => {
      const { mintAmount } = returnValues.result;

      const max = BigNumber.maximum(obj.mintAmout, mintAmount);

      if (max === obj.mintAmount) {
        return {
          mintAmount: obj.mintAmount,
          address: obj.address,
        };
      } else {
        return {
          mintAmount,
          address,
        };
      }
    },
    { mintAmount: 0, address: undefined }
  );
};

console.log(maxMintData);

////////////////////////////////////////////////////////////////////////////////
// write a nodejs code to find the minter address who minted the biggest mintAmount between blocks
// 7710758 to 8710758. Print the address and the mintAmount translate to USD.
// Note that:
//    1) 1e18 mintAmount = 1 ETH.
//    2) Use any public free api you wish to find the ETH to USD conversion rate
//    3) Calling getCEthMintEvents wirh the entire block range will crash. you need to break it into multiple calls, each with atmost 1000 blocks
//       and make these calls run in parallel.
