import { config } from "dotenv";
import { IBundler, Bundler } from "@biconomy/bundler";
import { ChainId } from "@biconomy/core-types";
import {
  BiconomySmartAccountV2,
  DEFAULT_ENTRYPOINT_ADDRESS,
} from "@biconomy/account";
import {
  ECDSAOwnershipValidationModule,
  DEFAULT_ECDSA_OWNERSHIP_MODULE,
} from "@biconomy/modules";
import {
  IPaymaster,
  BiconomyPaymaster,
  IHybridPaymaster,
  PaymasterFeeQuote,
  PaymasterMode,
  SponsorUserOperationDto,
} from "@biconomy/paymaster";
import { ethers } from "ethers";

import nftabi from "./abi/nft.json";
import wmaticabi from "./abi/wmatic.json";

config();

const address1: any = process.env.address1;
const address2: any = process.env.address2;

const provider = new ethers.providers.JsonRpcProvider(process.env.providerapi);

const signerkey: any = process.env.signerkey;
const bundlerapi = process.env.bundlerapi;
const paymasterapi: any = process.env.paymasterapi;

const wallet = new ethers.Wallet(signerkey, provider);

const bundler: IBundler = new Bundler({
  bundlerUrl:
    "https://bundler.biconomy.io/api/v2/80001/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44",
  chainId: ChainId.POLYGON_MUMBAI,
  entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
});

const paymaster: IPaymaster = new BiconomyPaymaster({
  paymasterUrl: paymasterapi,
});

async function createSmartAccount() {
  const module = await ECDSAOwnershipValidationModule.create({
    signer: wallet,
    moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE,
  });

  let biconomySmartAccount = await BiconomySmartAccountV2.create({
    chainId: ChainId.POLYGON_MUMBAI,
    bundler: bundler,
    paymaster: paymaster,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
    defaultValidationModule: module,
    activeValidationModule: module,
  });

  const eoa = await wallet.getAddress();
  const nonce = await biconomySmartAccount.getNonce();

  console.log(
    `smart account address is : "${await biconomySmartAccount.getAccountAddress()}" and nonce is : ${nonce}`
  );
  console.log("owner of smart contract wallet is  : ", eoa);
  const address = await biconomySmartAccount.getAccountAddress();
// get balance of smart contract wallet.
  const balance = await provider.getBalance(address);
  const balanceEther = ethers.utils.formatEther(balance);
  console.log(`balance of smart acount wallet  "${address}" is :  "${balanceEther}"`);
  return biconomySmartAccount;
}

async function singleTransaction() {
  const module = await ECDSAOwnershipValidationModule.create({
    signer: wallet,
    moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE,
  });
  const smartAccount = await createSmartAccount();
  try {
    const transaction = {
      to: address1,
      data: "0x",
      value: ethers.utils.parseEther("0.01"),
    };
    const signedTransaction = await wallet.signTransaction(transaction);
    const sendtranscation = await provider.sendTransaction(signedTransaction);
    console.log("signedTransaction through eoa is : ", signedTransaction);

    const userOp = await smartAccount.buildUserOp([transaction]);
    console.log(userOp, "userOp");
    const userOpResponse = await smartAccount.sendUserOp(userOp);

    const transactionDetail = await userOpResponse.wait();

    console.log("transaction detail below");
    console.log(
      `https://mumbai.polygonscan.com/tx/${transactionDetail.receipt.transactionHash}`
    );
  } catch (error) {
    console.log(error);
  }
}

const multipletranscation = async () => {
  const smartAccount = await createSmartAccount();
  const nftAddress = "0x007f1f32b7A47c1EcB0Da51a3F5a5953Ab15A7Ad";
  const contract = new ethers.Contract(nftAddress, nftabi, provider);
  try {
    const minTx = await contract.populateTransaction.publicMint(address1);
    const tx1 = {
      to: nftAddress,
      data: minTx.data,
    };

    const minTx2 = await contract.populateTransaction.publicMint(address2);
    const tx2 = {
      to: nftAddress,
      data: minTx2.data,
    };
    let userOp = await smartAccount.buildUserOp([tx1, tx2]);
    console.log("userOp", userOp);

    const userOpResponse = await smartAccount.sendUserOp(userOp);

    const { receipt } = await userOpResponse.wait(1);
    console.log("txHash", receipt.transactionHash);
  } catch (err: any) {
    console.error(err);
  }
};

const publicMintwithsponsoredPaymaster = async () => {
  const smartAccount = await createSmartAccount();
  const nftAddress = "0x007f1f32b7A47c1EcB0Da51a3F5a5953Ab15A7Ad";
  const contract = new ethers.Contract(nftAddress, nftabi, provider);
  try {
    const minTx = await contract.populateTransaction.publicMint(address1);
    const tx1 = {
      to: nftAddress,
      data: minTx.data,
    };

    let userOp = await smartAccount.buildUserOp([tx1]);

    const biconomyPaymaster =
      smartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;
    let paymasterServiceData: SponsorUserOperationDto = {
      mode: PaymasterMode.SPONSORED,
      smartAccountInfo: {
        name: "BICONOMY",
        version: "1.0.0",
      },
    };
    try {
      const paymasterAndDataResponse =
        await biconomyPaymaster.getPaymasterAndData(
          userOp,
          paymasterServiceData
        );
      userOp.paymasterAndData = paymasterAndDataResponse.paymasterAndData;

      if (
        paymasterAndDataResponse.callGasLimit &&
        paymasterAndDataResponse.verificationGasLimit &&
        paymasterAndDataResponse.preVerificationGas
      ) {
        userOp.callGasLimit = paymasterAndDataResponse.callGasLimit;
        userOp.verificationGasLimit =
          paymasterAndDataResponse.verificationGasLimit;
        userOp.preVerificationGas = paymasterAndDataResponse.preVerificationGas;
      }
    } catch (e) {
      console.log("error received ", e);
    }

    const userOpResponse = await smartAccount.sendUserOp(userOp);

    const { receipt } = await userOpResponse.wait();
    console.log("txHash", receipt.transactionHash);
  } catch (err: any) {
    console.error(err);
  }
};

const publicMintwitherc20Paymaster = async () => {
  const smartAccount = await createSmartAccount();
  const smartAccountaddress = await smartAccount.getAccountAddress();
  const nftAddress = "0x007f1f32b7A47c1EcB0Da51a3F5a5953Ab15A7Ad";
  const contract = new ethers.Contract(nftAddress, nftabi, provider);
  try {
    const minTx = await contract.populateTransaction.publicMint(address1);
    const tx1 = {
      to: nftAddress,
      data: minTx.data,
    };

    let userOp = await smartAccount.buildUserOp([tx1]);

    const biconomyPaymaster =
      smartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;

    const feeQuotesResponse =
      await biconomyPaymaster.getPaymasterFeeQuotesOrData(userOp, {
        mode: PaymasterMode.ERC20,
        // one can pass tokenList empty array. and it would return fee quotes for all tokens supported by the Biconomy paymaster
        tokenList: ["0x9c3c9283d3e44854697cd22d3faa240cfb032889"],
      });

    const feeQuotes = feeQuotesResponse.feeQuotes as PaymasterFeeQuote[];

    const spender = feeQuotesResponse.tokenPaymasterAddress || "";

    const selectedFeeQuote = feeQuotes[0];
    const selectedTokenaddress = selectedFeeQuote.tokenAddress;
    const wmaticcontract = new ethers.Contract(
      selectedTokenaddress,
      wmaticabi,
      provider
    );
    const b = await wmaticcontract.balanceOf(smartAccountaddress);

    const wallettoken = ethers.utils.formatUnits(b, "ether");
    console.log("erc20 token in smart contract wallet is :", wallettoken);

    // - Once you have selectebundlerapid feeQuote (use has chosen token to pay with) get updated userOp which checks for paymaster approval and appends approval tx--------------------------------//

    userOp = await smartAccount.buildTokenPaymasterUserOp(userOp, {
      feeQuote: selectedFeeQuote,
      spender: spender,
      maxApproval: false,
    });

    let paymasterServiceData = {
      mode: PaymasterMode.ERC20, // - mandatory // now we know chosen fee token and requesting paymaster and data for it
      feeTokenAddress: selectedFeeQuote.tokenAddress,
    };

    try {
      const paymasterAndDataWithLimits =
        await biconomyPaymaster.getPaymasterAndData(
          userOp,
          paymasterServiceData
        );
      userOp.paymasterAndData = paymasterAndDataWithLimits.paymasterAndData;

      // below code is only needed if you sent the flag calculateGasLimits = true
      if (
        paymasterAndDataWithLimits.callGasLimit &&
        paymasterAndDataWithLimits.verificationGasLimit &&
        paymasterAndDataWithLimits.preVerificationGas
      ) {
        userOp.callGasLimit = paymasterAndDataWithLimits.callGasLimit;
        userOp.verificationGasLimit =
          paymasterAndDataWithLimits.verificationGasLimit;
        userOp.preVerificationGas =
          paymasterAndDataWithLimits.preVerificationGas;
      }
    } catch (e) {
      console.log("error received ", e);
    }

    const userOpResponse = await smartAccount.sendUserOp(userOp);

    const { receipt } = await userOpResponse.wait();
    console.log("txHash", receipt.transactionHash);
  } catch (err: any) {
    console.error(err);
  }
};

createSmartAccount();
//singleTransaction()
//multipletranscation()
//publicMintwithsponsoredPaymaster();
//publicMintwitherc20Paymaster();
