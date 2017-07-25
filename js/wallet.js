var ecurve = require('ecurve')
var BigInteger = require('bigi')
var ecdsa = require('ecdsa')
var CoinKey = require('CoinKey')
var Buffer = require('Buffer')
var sr = require('secure-random')
var cryptos = require('crypto')
var secp256r1 = require('secp256k1')
var randomBytes = require('crypto').randomBytes
var BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
var base58 = require('base-x')(BASE58)
//var sm2 = require('sm.js').sm2;
//var sm3 = require('sm.js').sm3;

function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function str2ab(str) {
	var bufView = new Uint8Array(str.length);
	for (var i = 0, strLen = str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return bufView;
}
/**
 * hexstring to arraybuffer
 * @param {*hexstring} str 
 */
function hexstring2ab(str) {
	var result = [];
	while (str.length >= 2) {
		result.push(parseInt(str.substring(0, 2), 16));
		str = str.substring(2, str.length);
	}

	return result;
}
/**
 * 将数组转化为16进制字符串
 * @param {*arraybuffer} arr 
 */
function ab2hexstring(arr) {
	var result = "";
	for (i = 0; i < arr.length; i++) {
		var str = arr[i].toString(16);
		str = str.length == 0 ? "00" :
			str.length == 1 ? "0" + str :
				str;
		result += str;
	}
	return result;
}

function reverseArray(arr) {
	var result = new Uint8Array(arr.length);
	for (i = 0; i < arr.length; i++) {
		result[i] = arr[arr.length - 1 - i];
	}

	return result;
}

function numStoreInMemory(num, length) {
	for (i = num.length; i < length; i++) {
		num = '0' + num;
	}
	var data = reverseArray(new Buffer(num, "HEX"));

	return ab2hexstring(data);
}

function stringToBytes(str) {
	var utf8 = unescape(encodeURIComponent(str));

	var arr = [];
	for (var i = 0; i < utf8.length; i++) {
		arr.push(utf8.charCodeAt(i));
	}

	return arr;
}

var Wallet = function Wallet(passwordHash, iv, masterKey, publicKeyHash, privateKeyEncrypted) {
	this.passwordHash = passwordHash;
	this.iv = iv;
	this.masterKey = masterKey;
	this.publicKeyHash = publicKeyHash;
	this.privateKeyEncrypted = privateKeyEncrypted;
};

//生成钱包文件
Wallet.generateWalletFileBlob = function ($privateKey, $password) {
	//console.log( "privateKey: ", $privateKey );
	//console.log( "password: ", $password );
	//通过wif获取私钥
	// var $privateKey = wallet.getPrivateKeyFromWIF($wif)
//通过私钥获取公钥
	var publicKey = Wallet.getPublicKey($privateKey, false);
	//console.log( "publicKey: ", publicKey.toString('hex') );
//通过私钥获取公钥编码
	var publicKeyEncoded = Wallet.getPublicKey($privateKey, true);
	//console.log( "publicKeyEncoded: ", publicKeyEncoded.toString('hex') );
//通过公钥编码生成脚本代码
	var scriptCode = Wallet.createSignatureScript(publicKeyEncoded);
	//console.log( "scriptCode: ", scriptCode );
//对脚本代码进行hash编码
	var scriptHash = Wallet.getHash(scriptCode);
	//console.log( "scriptHash: ", scriptHash.toString() );
//公钥的hash码
	var publicKeyHash = Wallet.getHash(publicKeyEncoded.toString('hex'));
	//console.log( "publicKeyHash: ", publicKeyHash.toString() );

	var passwordKey = CryptoJS.SHA256(CryptoJS.SHA256($password));
	var passwordHash = CryptoJS.SHA256(passwordKey);
	//console.log( "passwordHash: ", passwordHash.toString() );

	var iv = Wallet.generateRandomArray(16);
	//console.log( "iv: ", ab2hexstring(iv) );

	var masterKey = Wallet.generateRandomArray(32);
	//console.log( "masterKey: ", ab2hexstring(masterKey) );

	// Encrypt MasterKey
	var masterKeyPlain = CryptoJS.enc.Hex.parse(ab2hexstring(masterKey));
	var key = CryptoJS.enc.Hex.parse(passwordKey.toString());
	var ivData = CryptoJS.enc.Hex.parse(ab2hexstring(iv));
	var masterKeyEncrypt = CryptoJS.AES.encrypt(masterKeyPlain, key, {
		// iv: ivData,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.NoPadding
	});
	console.log( "masterKeyEncrypt: ", masterKeyEncrypt.ciphertext.toString() );

	// PrivateKey Data
	var privateKeyData = publicKey.slice(1, 65).toString('hex') + $privateKey;
	console.log( "privateKeyData: ", privateKeyData );

	// Encrypt PrivateKey Data
	var privateKeyDataPlain = CryptoJS.enc.Hex.parse(privateKeyData);
	var privateKeyDataEncrypted = CryptoJS.AES.encrypt(privateKeyDataPlain, masterKeyPlain, {
		// iv: ivData,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.NoPadding
	});
	console.log( "privateKeyDataEncrypted: ", privateKeyDataEncrypted.ciphertext.toString() );

	return privateKeyDataEncrypted.ciphertext.toString();
}

Wallet.Sha256 = function ($data) {
	var DataHexString = CryptoJS.enc.Hex.parse($data);
	var DataSha256 = CryptoJS.SHA256(DataHexString);

	return DataSha256.toString();
}

Wallet.SM3 = function ($data) {
	var x = sm3();
	var DataHexString = hexstring2ab( $data );
	return ab2hexstring( x.sum(DataHexString) );
}
/**
 * MD5加密算法
 */
Wallet.MD5 = function ($data) {
	var DataHexString = CryptoJS.enc.Hex.parse($data);
	return CryptoJS.MD5(DataHexString).toString();
}
/**
 * 双次shash
 */
Wallet.GetTxHash = function ($data) {
	var DataHexString = CryptoJS.enc.Hex.parse($data);
	var DataSha256 = CryptoJS.SHA256(DataHexString);
	var DataSha256_2 = CryptoJS.SHA256(DataSha256);

	return DataSha256_2.toString();
}

Wallet.GetInputData = function ($coin, $amount) {
	// sort 冒泡排序
	var coin_ordered = $coin['list'];
	for (i = 0; i < coin_ordered.length - 1; i++) {
		for (j = 0; j < coin_ordered.length - 1 - i; j++) {
			if (parseFloat(coin_ordered[j].value) < parseFloat(coin_ordered[j + 1].value)) {
				var temp = coin_ordered[j];
				coin_ordered[j] = coin_ordered[j + 1];
				coin_ordered[j + 1] = temp;
			}
		}
	}
	console.log('coin_ordered');
	console.log( coin_ordered );

	// calc sum 计算总量
	var sum = 0;
	for (i = 0; i < coin_ordered.length; i++) {
		sum = sum + parseFloat(coin_ordered[i].value);
	}

	// if sum < amount then exit; 如果总量没有要转入的余额大
	var amount = parseFloat($amount);
	if (sum < amount) return -1;

	// find input coins 算出被减完
	var k = 0;
	while (parseFloat(coin_ordered[k].value) <= amount) {
		amount = amount - parseFloat(coin_ordered[k].value);
		if (amount == 0) break;
		k = k + 1;
	}

	/////////////////////////////////////////////////////////////////////////
	// coin[0]- coin[k]
	var data = new Uint8Array(1 + 34 * (k + 1));

	// input num
	var inputNum = numStoreInMemory((k + 1).toString(16), 2);
	data.set(hexstring2ab(inputNum));

	// input coins
	for (var x = 0; x < k + 1; x++) {

		// txid
		var pos = 1 + (x * 34);
		data.set(reverseArray(hexstring2ab(coin_ordered[x]['txid'])),pos);
		//data.set(hexstring2ab(coin_ordered[x]['txid']), pos);

		// index
		pos = 1 + (x * 34) + 32;
		inputIndex = numStoreInMemory(coin_ordered[x]['n'].toString(16),4);
		//inputIndex = numStoreInMemory(coin_ordered[x]['n'].toString(16), 2);
		data.set(hexstring2ab(inputIndex), pos);
	}

	/////////////////////////////////////////////////////////////////////////

	// calc coin_amount
	var coin_amount = 0;
	for (i = 0; i < k + 1; i++) {
		coin_amount = coin_amount + parseFloat(coin_ordered[i].value);
	}

	/////////////////////////////////////////////////////////////////////////

	return {
		amount: coin_amount,
		data: data
	}

}

Wallet.IssueTransaction = function ($issueAssetID, $issueAmount, $publicKeyEncoded) {

	var signatureScript = Wallet.createSignatureScript($publicKeyEncoded);
	//console.log( signatureScript.toString('hex') );

	var myProgramHash = Wallet.getHash(signatureScript);
	//console.log( myProgramHash.toString() );

	////////////////////////////////////////////////////////////////////////
	// data
	var data = "01";

	// version
	data = data + "00";

	// attribute
	data = data + "00";

	// Inputs
	data = data + "00";

	// Outputs len
	data = data + "01";

	// Outputs[0] AssetID
	data = data + $issueAssetID

	// Outputs[0] Amount
	num1 = $issueAmount * 100000000;
	num1str = numStoreInMemory(num1.toString(16), 16);
	data = data + num1str;

	// Outputs[0] ProgramHash
	data = data + myProgramHash.toString()

	//console.log(data);

	return data;
}
/**
 * 登录交易
 */
Wallet.RegisterTransaction = function ($assetName, $assetAmount, $publicKeyEncoded) {
	console.log( "publicKeyEncoded:", $publicKeyEncoded );

	var ecparams = ecurve.getCurveByName('secp256r1');
	var curvePt = ecurve.Point.decodeFrom(ecparams,new Buffer($publicKeyEncoded,"hex"));
	var curvePtX = curvePt.affineX.toBuffer(32);
	var curvePtY = curvePt.affineY.toBuffer(32);
	var publicKey = Buffer.concat([new Buffer([0x04]), curvePtX, curvePtY]);

	var signatureScript = Wallet.createSignatureScript($publicKeyEncoded);
	console.log( signatureScript.toString('hex') );

	var myProgramHash = Wallet.getHash(signatureScript);
	console.log( myProgramHash.toString() );

	// data
	var data = "40";

	// version
	data = data + "00";

	// asset name
	var assetName = ab2hexstring(stringToBytes($assetName));
	var assetNameLen = (assetName.length / 2).toString()
	if (assetNameLen.length == 1) assetNameLen = "0" + assetNameLen;
	data = data + assetNameLen + assetName;

	// asset precision
	data = data + "00";

	// asset type
	data = data + "01";

	// asset recordtype
	data = data + "00";

	// asset amount
	num1 = $assetAmount * 100000000;
	num1str = numStoreInMemory(num1.toString(16), 16);
	data = data + num1str;

	// publickey
	var publicKeyXStr = curvePtX.toString('hex');
	var publicKeyYStr = curvePtY.toString('hex');

	data = data + "20" + publicKeyXStr + "20" + publicKeyYStr;
	data = data + myProgramHash.toString();
	data = data + "000000";

	console.log(data);

	return data;
}
/**
 * 补充签名
 */
Wallet.AddContract = function ( $txData, $sign, $publicKeyEncoded ) {
	var signatureScript = Wallet.createSignatureScript($publicKeyEncoded);

	// sign num
	var data = $txData + "01";
	// sign struct len
	data = data + "41";
	// sign data len
	data = data + "40";
	// sign data
	data = data + $sign;
	// Contract data len
	data = data + "23";
	// script data
	data = data + signatureScript;

	return data;
}
/**
 * 校验地址
 */
Wallet.VerifyAddress = function ( $toAddress ) {

	var ProgramHash = base58.decode($toAddress);
	var ProgramHexString = CryptoJS.enc.Hex.parse(ab2hexstring(ProgramHash.slice(0, 21)));
	var ProgramSha256 = CryptoJS.SHA256(ProgramHexString);
	var ProgramSha256_2 = CryptoJS.SHA256(ProgramSha256);
	var ProgramSha256Buffer = hexstring2ab(ProgramSha256_2.toString());

	if (ab2hexstring(ProgramSha256Buffer.slice(0, 4)) != ab2hexstring(ProgramHash.slice(21, 25))) {
		//address verify failed.
		return false;
	}

	return true;
}
/**
 * 验证公钥编码
 */
Wallet.VerifyPublicKeyEncoded = function ( $publicKeyEncoded ) {
	var publicKeyArray = hexstring2ab( $publicKeyEncoded );
	if ( publicKeyArray[0] != 0x02 && publicKeyArray[0] != 0x03 ) {
		return false;
	}

	var ecparams = ecurve.getCurveByName('secp256r1');
	var curvePt = ecurve.Point.decodeFrom(ecparams,new Buffer($publicKeyEncoded,"hex"));
	var curvePtX = curvePt.affineX.toBuffer(32);
	var curvePtY = curvePt.affineY.toBuffer(32);

	// console.log( "publicKeyArray", publicKeyArray );
	// console.log( "curvePtX", curvePtX );
	// console.log( "curvePtY", curvePtY );

	if ( publicKeyArray[0] == 0x02 && curvePtY[31] % 2 == 0 ) {
		return true;
	} 

	if ( publicKeyArray[0] == 0x03 && curvePtY[31] % 2 == 1 ) {
		return true;
	} 

	return false;
}
/**
 * 交易转让
 */
Wallet.TransferTransaction = function ($coin, $publicKeyEncoded, $toAddress, $Amount) {

	var ProgramHash = base58.decode($toAddress);
	var ProgramHexString = CryptoJS.enc.Hex.parse(ab2hexstring(ProgramHash.slice(0, 21)));
	var ProgramSha256 = CryptoJS.SHA256(ProgramHexString);
	var ProgramSha256_2 = CryptoJS.SHA256(ProgramSha256);
	var ProgramSha256Buffer = hexstring2ab(ProgramSha256_2.toString());

	if (ab2hexstring(ProgramSha256Buffer.slice(0, 4)) != ab2hexstring(ProgramHash.slice(21, 25))) {
		//address verify failed.
		return -1;
	}

	ProgramHash = ProgramHash.slice(1, 21)

	var signatureScript = Wallet.createSignatureScript($publicKeyEncoded);
	var myProgramHash = Wallet.getHash(signatureScript);

	// INPUT CONSTRUCT
	var inputData = Wallet.GetInputData($coin, $Amount);
	if (inputData == -1) return null;
	//console.log( inputData );

	var inputLen = inputData.data.length;
	var inputAmount = inputData.amount;

	// Set SignableData Len
	var signableDataLen = 124 + inputLen;
	if (inputAmount == $Amount) {
		signableDataLen = 64 + inputLen;
	}

	// CONSTRUCT
	var data = new Uint8Array(signableDataLen);

	// type
	data.set(hexstring2ab("80"), 0);

	// version
	data.set(hexstring2ab("00"), 1);

	// Attributes
	data.set(hexstring2ab("00"), 2);

	// INPUT
	data.set(inputData.data, 3);

	// OUTPUT
	if (inputAmount == $Amount) {
		// only one output

		// output num
		data.set(hexstring2ab("01"), inputLen + 3);

		////////////////////////////////////////////////////////////////////
		// OUTPUT - 0

		// output asset
		data.set(reverseArray(hexstring2ab($coin['assetid'])),inputLen+4);
		//data.set(hexstring2ab($coin['assetid']), inputLen + 4);

		// output value
		num1 = $Amount * 100000000;
		num1str = numStoreInMemory(num1.toString(16), 16);
		data.set(hexstring2ab(num1str), inputLen + 36);

		// output ProgramHash
		data.set(ProgramHash, inputLen + 44);

		////////////////////////////////////////////////////////////////////

	} else {

		// output num
		data.set(hexstring2ab("02"), inputLen + 3);

		////////////////////////////////////////////////////////////////////
		// OUTPUT - 0

		// output asset
		data.set(reverseArray(hexstring2ab($coin['assetid'])),inputLen+4);
		//data.set(hexstring2ab($coin['assetid']), inputLen + 4);

		// output value
		num1 = $Amount * 100000000;
		num1str = numStoreInMemory(num1.toString(16), 16);
		data.set(hexstring2ab(num1str), inputLen + 36);

		// output ProgramHash
		data.set(ProgramHash, inputLen + 44);

		////////////////////////////////////////////////////////////////////
		// OUTPUT - 1

		// output asset
		data.set(reverseArray(hexstring2ab($coin['assetid'])),inputLen+64);
		//data.set(hexstring2ab($coin['assetid']), inputLen + 64);

		// output value
		num2 = inputAmount * 100000000 - num1;
		num2str = numStoreInMemory(num2.toString(16), 16);
		data.set(hexstring2ab(num2str), inputLen + 96);

		// output ProgramHash
		data.set(hexstring2ab(myProgramHash.toString()), inputLen + 104);

		////////////////////////////////////////////////////////////////////

		//console.log( "Signature Data:", ab2hexstring(data) );
	}

	return ab2hexstring(data);
};
/**
 * 现金交易
 */
Wallet.ClaimTransaction = function ($claims, $publicKeyEncoded, $toAddress, $Amount) {

	var signatureScript = Wallet.createSignatureScript($publicKeyEncoded);
	//console.log( signatureScript.toString('hex') );

	var myProgramHash = Wallet.getHash(signatureScript);
	//console.log( myProgramHash.toString() );

	////////////////////////////////////////////////////////////////////////
	// data
	var data = "02";

	// version
	data = data + "00";

	// claim
	// TODO: !!! var int
	len = $claims['claims'].length
	lenstr = numStoreInMemory(len.toString(16), 2);
	data = data + lenstr

	//console.log("len: ", len);
	for ( var k=0; k<len; k++ ) {
		txid = $claims['claims'][k]['txid'];
		data = data + ab2hexstring(reverseArray(hexstring2ab(txid)));

		vout = $claims['claims'][k]['vout'].toString(16);
		data = data + numStoreInMemory(vout, 4);
	}

	// attribute
	data = data + "00";

	// Inputs
	data = data + "00";

	// Outputs len
	data = data + "01";

	// Outputs[0] AssetID
	data = data + ab2hexstring(reverseArray(hexstring2ab($claims['assetid'])))

	// Outputs[0] Amount
	num1 = parseInt($Amount);
	num1str = numStoreInMemory(num1.toString(16), 16);
	data = data + num1str;

	// Outputs[0] ProgramHash
	data = data + myProgramHash.toString()

	//console.log(data);

	return data;
};

Wallet.ToAddress = function ($ProgramHash) {
	var data = new Uint8Array(1 + $ProgramHash.length);
	data.set([23]);
	data.set($ProgramHash, 1);
	//console.log(ab2hexstring(data));

	var ProgramHexString = CryptoJS.enc.Hex.parse(ab2hexstring(data));
	var ProgramSha256 = CryptoJS.SHA256(ProgramHexString);
	var ProgramSha256_2 = CryptoJS.SHA256(ProgramSha256);
	var ProgramSha256Buffer = hexstring2ab(ProgramSha256_2.toString());
	//console.log(ab2hexstring(ProgramSha256Buffer));

	var datas = new Uint8Array(1 + $ProgramHash.length + 4);
	datas.set(data);
	datas.set(ProgramSha256Buffer.slice(0, 4), 21);
	//console.log(ab2hexstring(datas));

	return base58.encode(datas);
};

/**
 * 生成随机数组
 */
Wallet.generateRandomArray = function ($arrayLen) {
	var randomArray = new Uint8Array($arrayLen);
	for (i = 0; i < $arrayLen; i++) {
		randomArray[i] = Math.floor(Math.random() * 256);
	}

	return randomArray;
}

/**
 * 生成私钥
 */
Wallet.generatePrivateKey = function () {
	var privateKey = new Uint8Array(32);
	for (i = 0; i < 32; i++) {
		privateKey[i] = Math.floor(Math.random() * 256);
	}

	return privateKey;
}

/**
 * 通过WIF生成私钥
 */
Wallet.getPrivateKeyFromWIF = function ($wif) {
	var data = base58.decode($wif);

	if (data.length != 38 || data[0] != 0x80 || data[33] != 0x01) {
		return -1;
	}

	var dataHexString = CryptoJS.enc.Hex.parse(ab2hexstring(data.slice(0, data.length - 4)));
	var dataSha256 = CryptoJS.SHA256(dataHexString);
	var dataSha256_2 = CryptoJS.SHA256(dataSha256);
	var dataSha256Buffer = hexstring2ab(dataSha256_2.toString());

	if (ab2hexstring(dataSha256Buffer.slice(0, 4)) != ab2hexstring(data.slice(data.length - 4, data.length))) {
		//wif verify failed.
		return -2;
	}

	return data.slice(1, 33).toString("hex");

};

/**
 * 获取公钥
 */
Wallet.getPublicKey = function ($privateKey, $encode) {
	//通过名称得到曲线
	var ecparams = ecurve.getCurveByName('secp256r1');
	//获得曲线控制点
	var curvePt = ecparams.G.multiply(BigInteger.fromBuffer(hexstring2ab($privateKey)));
	//根据 encode= true/false 输出编码
	return curvePt.getEncoded($encode);
};

/**
 * 获取公钥编码
 */
Wallet.getPublicKeyEncoded = function ($publicKey) {
	var publicKeyArray = hexstring2ab($publicKey);
	if ( publicKeyArray[64] % 2 == 1 ) {
		return "03" + ab2hexstring(publicKeyArray.slice(1, 33));
	} else {
		return "02" + ab2hexstring(publicKeyArray.slice(1, 33));
	}
}

/**
 * 创建签名脚本
 */
Wallet.createSignatureScript = function ($publicKeyEncoded) {
	console.log("$publicEncode");
	console.log($publicKeyEncoded.toString);
	return "21" + $publicKeyEncoded.toString('hex') + "ac";
};

/**
 * get Hash
 */
Wallet.getHash = function ($SignatureScript) {
	var ProgramHexString = CryptoJS.enc.Hex.parse($SignatureScript);
	var ProgramSha256 = CryptoJS.SHA256(ProgramHexString);
	return CryptoJS.RIPEMD160(ProgramSha256);
};

/**
 * 签名数据
 */
Wallet.signatureData = function ($data, $privateKey) {
	var msg = CryptoJS.enc.Hex.parse($data);
	var msgHash = CryptoJS.SHA256(msg);
	//console.log( "msgHash:", msgHash.toString() );

	var pubKey = secp256r1.publicKeyCreate(new Buffer($privateKey, "HEX"));
	//console.log( pubKey.toString('hex') );

	var signature = secp256r1.sign(new Buffer(msgHash.toString(), "HEX"), new Buffer($privateKey, "HEX"));
	//console.log( signature.signature.toString('hex') );

	return signature.signature.toString('hex');
};

/**
 * 解密钱包 通过公钥
 */
Wallet.GetAccountsFromPublicKeyEncoded = function ($publicKeyEncoded) {

	if ( !Wallet.VerifyPublicKeyEncoded( $publicKeyEncoded ) ) {
		// verify failed.
		return -1
	}

	var accounts = [];

	var publicKeyHash = Wallet.getHash($publicKeyEncoded);
	//console.log( publicKeyHash );

	var script = Wallet.createSignatureScript($publicKeyEncoded);
	//console.log( script );

	var programHash = Wallet.getHash(script);
	//console.log( programHash );

	var address = Wallet.ToAddress(hexstring2ab(programHash.toString()));
	//console.log( address );

	accounts[0] = {
		privatekey: '',
		publickeyEncoded: $publicKeyEncoded,
		publickeyHash: publicKeyHash.toString(),
		programHash: programHash.toString(),
		address: address,
	};

	return accounts;
}

/**
 * 从私钥获取账号
 */
Wallet.GetAccountsFromPrivateKey = function ($privateKey) {
	if ($privateKey.length != 64) {
		return -1;
	}

	var accounts = [];
	var publicKeyEncoded = Wallet.getPublicKey($privateKey, true);
	//console.log( publicKeyEncoded );

	var publicKeyHash = Wallet.getHash(publicKeyEncoded.toString('hex'));
	//console.log( publicKeyHash );

	var script = Wallet.createSignatureScript(publicKeyEncoded);
	//console.log( script );

	var programHash = Wallet.getHash(script);
	//console.log( programHash );

	var address = Wallet.ToAddress(hexstring2ab(programHash.toString()));
	//console.log( address );

	accounts[0] = {
		privatekey: $privateKey,
		publickeyEncoded: publicKeyEncoded.toString('hex'),
		publickeyHash: publicKeyHash.toString(),
		programHash: programHash.toString(),
		address: address,
	};

	return accounts;
}

/**
 * 从WiFi获取账号
 */
Wallet.GetAccountsFromWIFKey = function ($WIFKey) {
	var privateKey = Wallet.getPrivateKeyFromWIF($WIFKey);
	if (privateKey == -1 || privateKey == -2) {
		return privateKey;
	}

	return Wallet.GetAccountsFromPrivateKey(privateKey);
}

/**
 * 解密钱包文件
 */
Wallet.decryptWallet = function (wallet, password) {
	var accounts = [];
	var passwordhash1 = CryptoJS.SHA256(password);
	var passwordhash2 = CryptoJS.SHA256(passwordhash1);
	var passwordhash3 = CryptoJS.SHA256(passwordhash2);
	if (passwordhash3.toString() != ab2hexstring(wallet.passwordHash)) {
		//PASSWORD WRONG
		return -1;
	}

	console.log("password verify success.");

	// Decrypt MasterKey
	var data = CryptoJS.enc.Hex.parse(ab2hexstring(wallet.masterKey));
	var dataBase64 = CryptoJS.enc.Base64.stringify(data);
	var key = CryptoJS.enc.Hex.parse(passwordhash2.toString());
	var iv = CryptoJS.enc.Hex.parse(ab2hexstring(wallet.iv));
	//console.log( "MasterKey:", ab2hexstring(wallet.masterKey) );
	//console.log(data);
	//console.log( "Password:", passwordhash2.toString() );
	//console.log(key);
	//console.log( "IV:",ab2hexstring(wallet.iv) );
	//console.log(iv);

	var plainMasterKey = CryptoJS.AES.decrypt(dataBase64, key, {
		iv: iv,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.NoPadding
	});

	//console.log( "plainMasterKey:", plainMasterKey.toString());

	for (k = 0; k < wallet.privateKeyEncrypted.length; k++) {

		// Decrypt PrivateKey
		var privateKeyEncrypted = CryptoJS.enc.Hex.parse(ab2hexstring(wallet.privateKeyEncrypted[k]));
		var privateKeyBase64 = CryptoJS.enc.Base64.stringify(privateKeyEncrypted);
		var plainprivateKey = CryptoJS.AES.decrypt(privateKeyBase64, plainMasterKey, {
			iv: iv,
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.NoPadding
		});

		//console.log( "plainprivateKey:", plainprivateKey.toString() );

		var privateKeyHexString = plainprivateKey.toString().slice(128, 192);
		//console.log( "privateKeyHexString:", privateKeyHexString);

		// Verify PublicKeyHash
		var ecparams = ecurve.getCurveByName('secp256r1');
		var curvePt = ecparams.G.multiply(BigInteger.fromBuffer(hexstring2ab(privateKeyHexString)));

		// Get PublicKey
		//var x = curvePt.affineX.toBuffer(32);
		//var y = curvePt.affineY.toBuffer(32);
		//var publicKey = new Uint8Array(1+x.length+y.length);
		//publicKey.set([0x04]);
		//publicKey.set(x,1);
		//publicKey.set(y,1+x.length);
		//console.log(publicKey.toString('hex'));

		// Get PublicKeyEncoded
		var publicKeyEncoded = curvePt.getEncoded(true);
		//console.log( "publicKeyEncoded:", publicKeyEncoded.toString('hex') );

		// Get PublicKeyHash
		var publicKeyEncodedHexString = CryptoJS.enc.Hex.parse(publicKeyEncoded.toString('hex'));
		var publicKeyEncodedSha256 = CryptoJS.SHA256(publicKeyEncodedHexString);
		var publicKeyHash = CryptoJS.RIPEMD160(publicKeyEncodedSha256);

		// Get ProgramHash
		var ProgramHexString = CryptoJS.enc.Hex.parse("21" + publicKeyEncoded.toString('hex') + "ac");
		var ProgramSha256 = CryptoJS.SHA256(ProgramHexString);
		var ProgramHash = CryptoJS.RIPEMD160(ProgramSha256);
		//console.log( "ProgramHexString:", ProgramHexString.toString() );
		//console.log( "ProgramHash:", ProgramHash.toString() );

		// Get Address
		var address = Wallet.ToAddress(hexstring2ab(ProgramHash.toString()));
		console.log("address:", address);

		//console.log( "k=", k );
		//console.log( "publicKeyHash:", publicKeyHash.toString() );
		//console.log( ab2hexstring(wallet.publicKeyHash[k]) );
		if (publicKeyHash.toString() != ab2hexstring(wallet.publicKeyHash[k])) {
			return -2;
		}

		accounts[k] = {
			privatekey: privateKeyHexString,
			publickeyEncoded: publicKeyEncoded.toString('hex'),
			publickeyHash: publicKeyHash.toString(),
			programHash: ProgramHash.toString(),
			address: address,
		};
	}

	return accounts
};

/**
 * 密码加密
 */
Wallet.encryptNeodunPrivateKey=function(data,key){//加密
	var key  = CryptoJS.enc.Hex.parse(Wallet.Sha256(Wallet.Sha256(key)));
	var iv   = CryptoJS.enc.Latin1.parse(Wallet.MD5(key).substr(0,16));
	var encrypted = CryptoJS.AES.encrypt(data,key,
			{
				iv:iv,
				mode:CryptoJS.mode.CBC,
				padding:CryptoJS.pad.Pkcs7
			});
	return encrypted.toString();
}
/**
 * 密码解密
 */
Wallet.decryptNeodunPrivateKey = function(encrypted,key){//解密
	var key  = CryptoJS.enc.Hex.parse(Wallet.Sha256(Wallet.Sha256(key)));
	var iv   = CryptoJS.enc.Latin1.parse(Wallet.MD5(key).substr(0,16));
	var decrypted = CryptoJS.AES.decrypt(encrypted,key,
			{
				iv:iv,
				mode:CryptoJS.mode.CBC,
				padding:CryptoJS.pad.Pkcs7
			});
	return decrypted.toString(CryptoJS.enc.Utf8);
}
