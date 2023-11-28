"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const bundler_1 = require("@biconomy/bundler");
const core_types_1 = require("@biconomy/core-types");
const account_1 = require("@biconomy/account");
const modules_1 = require("@biconomy/modules");
const paymaster_1 = require("@biconomy/paymaster");
const ethers_1 = require("ethers");
const nft_json_1 = __importDefault(require("./abi/nft.json"));
const wmatic_json_1 = __importDefault(require("./abi/wmatic.json"));
(0, dotenv_1.config)();
const address1 = process.env.address1;
const address2 = process.env.address2;
const provider = new ethers_1.ethers.providers.JsonRpcProvider(process.env.providerapi);
const signerkey = process.env.signerkey;
const bundlerapi = process.env.bundlerapi;
const paymasterapi = process.env.paymasterapi;
const wallet = new ethers_1.ethers.Wallet(signerkey, provider);
const bundler = new bundler_1.Bundler({
    bundlerUrl: "https://bundler.biconomy.io/api/v2/80001/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44",
    chainId: core_types_1.ChainId.POLYGON_MUMBAI,
    entryPointAddress: account_1.DEFAULT_ENTRYPOINT_ADDRESS,
});
const paymaster = new paymaster_1.BiconomyPaymaster({
    paymasterUrl: paymasterapi,
});
function createSmartAccount() {
    return __awaiter(this, void 0, void 0, function* () {
        const module = yield modules_1.ECDSAOwnershipValidationModule.create({
            signer: wallet,
            moduleAddress: modules_1.DEFAULT_ECDSA_OWNERSHIP_MODULE,
        });
        let biconomySmartAccount = yield account_1.BiconomySmartAccountV2.create({
            chainId: core_types_1.ChainId.POLYGON_MUMBAI,
            bundler: bundler,
            paymaster: paymaster,
            entryPointAddress: account_1.DEFAULT_ENTRYPOINT_ADDRESS,
            defaultValidationModule: module,
            activeValidationModule: module,
        });
        const eoa = yield wallet.getAddress();
        const nonce = yield biconomySmartAccount.getNonce();
        console.log(`smart account address is : "${yield biconomySmartAccount.getAccountAddress()}" and nonce is : ${nonce}`);
        console.log("owner of smart contract wallet is  : ", eoa);
        const address = yield biconomySmartAccount.getAccountAddress();
        const balance = yield provider.getBalance(address);
        const balanceEther = ethers_1.ethers.utils.formatEther(balance);
        console.log(`balance of smart acount wallet  "${address}" is :  "${balanceEther}"`);
        return biconomySmartAccount;
    });
}
function singleTransaction() {
    return __awaiter(this, void 0, void 0, function* () {
        const module = yield modules_1.ECDSAOwnershipValidationModule.create({
            signer: wallet,
            moduleAddress: modules_1.DEFAULT_ECDSA_OWNERSHIP_MODULE,
        });
        const smartAccount = yield createSmartAccount();
        try {
            const transaction = {
                to: address1,
                data: "0x",
                value: ethers_1.ethers.utils.parseEther("0.01"),
            };
            const signedTransaction = yield wallet.signTransaction(transaction);
            const sendtranscation = yield provider.sendTransaction(signedTransaction);
            console.log("signedTransaction through eoa is : ", signedTransaction);
            const userOp = yield smartAccount.buildUserOp([transaction]);
            console.log(userOp, "userOp");
            const userOpResponse = yield smartAccount.sendUserOp(userOp);
            const transactionDetail = yield userOpResponse.wait();
            console.log("transaction detail below");
            console.log(`https://mumbai.polygonscan.com/tx/${transactionDetail.receipt.transactionHash}`);
        }
        catch (error) {
            console.log(error);
        }
    });
}
const multipletranscation = () => __awaiter(void 0, void 0, void 0, function* () {
    const smartAccount = yield createSmartAccount();
    const nftAddress = "0x007f1f32b7A47c1EcB0Da51a3F5a5953Ab15A7Ad";
    const contract = new ethers_1.ethers.Contract(nftAddress, nft_json_1.default, provider);
    try {
        const minTx = yield contract.populateTransaction.publicMint(address1);
        const tx1 = {
            to: nftAddress,
            data: minTx.data,
        };
        const minTx2 = yield contract.populateTransaction.publicMint(address2);
        const tx2 = {
            to: nftAddress,
            data: minTx2.data,
        };
        let userOp = yield smartAccount.buildUserOp([tx1, tx2]);
        console.log("userOp", userOp);
        const userOpResponse = yield smartAccount.sendUserOp(userOp);
        const { receipt } = yield userOpResponse.wait(1);
        console.log("txHash", receipt.transactionHash);
    }
    catch (err) {
        console.error(err);
    }
});
const publicMintwithsponsoredPaymaster = () => __awaiter(void 0, void 0, void 0, function* () {
    const smartAccount = yield createSmartAccount();
    const nftAddress = "0x007f1f32b7A47c1EcB0Da51a3F5a5953Ab15A7Ad";
    const contract = new ethers_1.ethers.Contract(nftAddress, nft_json_1.default, provider);
    try {
        const minTx = yield contract.populateTransaction.publicMint(address1);
        const tx1 = {
            to: nftAddress,
            data: minTx.data,
        };
        let userOp = yield smartAccount.buildUserOp([tx1]);
        const biconomyPaymaster = smartAccount.paymaster;
        let paymasterServiceData = {
            mode: paymaster_1.PaymasterMode.SPONSORED,
            smartAccountInfo: {
                name: "BICONOMY",
                version: "1.0.0",
            },
        };
        try {
            const paymasterAndDataResponse = yield biconomyPaymaster.getPaymasterAndData(userOp, paymasterServiceData);
            userOp.paymasterAndData = paymasterAndDataResponse.paymasterAndData;
            if (paymasterAndDataResponse.callGasLimit &&
                paymasterAndDataResponse.verificationGasLimit &&
                paymasterAndDataResponse.preVerificationGas) {
                userOp.callGasLimit = paymasterAndDataResponse.callGasLimit;
                userOp.verificationGasLimit =
                    paymasterAndDataResponse.verificationGasLimit;
                userOp.preVerificationGas = paymasterAndDataResponse.preVerificationGas;
            }
        }
        catch (e) {
            console.log("error received ", e);
        }
        const userOpResponse = yield smartAccount.sendUserOp(userOp);
        const { receipt } = yield userOpResponse.wait();
        console.log("txHash", receipt.transactionHash);
    }
    catch (err) {
        console.error(err);
    }
});
const publicMintwitherc20Paymaster = () => __awaiter(void 0, void 0, void 0, function* () {
    const smartAccount = yield createSmartAccount();
    const smartAccountaddress = yield smartAccount.getAccountAddress();
    const nftAddress = "0x007f1f32b7A47c1EcB0Da51a3F5a5953Ab15A7Ad";
    const contract = new ethers_1.ethers.Contract(nftAddress, nft_json_1.default, provider);
    try {
        const minTx = yield contract.populateTransaction.publicMint(address1);
        const tx1 = {
            to: nftAddress,
            data: minTx.data,
        };
        let userOp = yield smartAccount.buildUserOp([tx1]);
        const biconomyPaymaster = smartAccount.paymaster;
        const feeQuotesResponse = yield biconomyPaymaster.getPaymasterFeeQuotesOrData(userOp, {
            mode: paymaster_1.PaymasterMode.ERC20,
            // one can pass tokenList empty array. and it would return fee quotes for all tokens supported by the Biconomy paymaster
            tokenList: ["0x9c3c9283d3e44854697cd22d3faa240cfb032889"],
        });
        const feeQuotes = feeQuotesResponse.feeQuotes;
        const spender = feeQuotesResponse.tokenPaymasterAddress || "";
        const selectedFeeQuote = feeQuotes[0];
        const selectedTokenaddress = selectedFeeQuote.tokenAddress;
        const wmaticcontract = new ethers_1.ethers.Contract(selectedTokenaddress, wmatic_json_1.default, provider);
        const b = yield wmaticcontract.balanceOf(smartAccountaddress);
        const wallettoken = ethers_1.ethers.utils.formatUnits(b, "ether");
        console.log("erc20 token in smart contract wallet is :", wallettoken);
        // - Once you have selectebundlerapid feeQuote (use has chosen token to pay with) get updated userOp which checks for paymaster approval and appends approval tx--------------------------------//
        userOp = yield smartAccount.buildTokenPaymasterUserOp(userOp, {
            feeQuote: selectedFeeQuote,
            spender: spender,
            maxApproval: false,
        });
        let paymasterServiceData = {
            mode: paymaster_1.PaymasterMode.ERC20, // - mandatory // now we know chosen fee token and requesting paymaster and data for it
            feeTokenAddress: selectedFeeQuote.tokenAddress,
        };
        try {
            const paymasterAndDataWithLimits = yield biconomyPaymaster.getPaymasterAndData(userOp, paymasterServiceData);
            userOp.paymasterAndData = paymasterAndDataWithLimits.paymasterAndData;
            // below code is only needed if you sent the flag calculateGasLimits = true
            if (paymasterAndDataWithLimits.callGasLimit &&
                paymasterAndDataWithLimits.verificationGasLimit &&
                paymasterAndDataWithLimits.preVerificationGas) {
                userOp.callGasLimit = paymasterAndDataWithLimits.callGasLimit;
                userOp.verificationGasLimit =
                    paymasterAndDataWithLimits.verificationGasLimit;
                userOp.preVerificationGas =
                    paymasterAndDataWithLimits.preVerificationGas;
            }
        }
        catch (e) {
            console.log("error received ", e);
        }
        const userOpResponse = yield smartAccount.sendUserOp(userOp);
        const { receipt } = yield userOpResponse.wait();
        console.log("txHash", receipt.transactionHash);
    }
    catch (err) {
        console.error(err);
    }
});
createSmartAccount();
//singleTransaction()
//multipletranscation()
//publicMintwithsponsoredPaymaster();
//publicMintwitherc20Paymaster();
//# sourceMappingURL=index.js.map