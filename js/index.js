    if (localStorage.wallets == undefined || localStorage.wallets == "[]" || localStorage.wallets == "") {
        localStorage.setItem("wallets", "[]");
    }

    function createShowObj(name, address, allassets, ciphertext, ifPrivate) {

        let obj = {
            name: name,
            allassets: allassets,
            showAddress: address.substr(0, 4) + "***" + address.substr(address.length - 4, address.length - 1),
            ciphertext: ciphertext,
            hideAddress: address,
            ifPrivate: ifPrivate
        }
        return obj;
    }

    class WalletList {
        constructor() {
            this.address = "";
            this.currency = "";
            this.number = 0;
        }
        addWallet(walletObj) {
            let wallets = localStorage.wallets;
            // this.address = address;
            if (wallets != undefined) {
                let walletArr = Array();
                walletArr = JSON.parse(localStorage.wallets);
                for (var i = 0; i < walletArr.length; i++) {
                    if (walletArr[i]["address"] == walletObj.address) {
                        // this.alertMessage = "校验失败，请输入正确的WIF";
                        $('#alert').modal('show');
                        return false;
                    }
                }
                walletArr.push(walletObj);
                localStorage.wallets = JSON.stringify(walletArr);
                return true;
            }
        }
        deleteWallet(index) {
            let wallets = Array();
            wallets = JSON.parse(localStorage.wallets);
            wallets.splice(index, 1);
            localStorage.wallets = JSON.stringify(wallets);
            return true;
        }
        getUnspent(address) {
            let unspent = new Array();
            $.ajax({
                url: "http://testnet.antchain.org:80/api/v1/address/get_unspent/" + address,
                type: 'GET',
                async: true,
                success: function(result) {
                    // Do something with the result
                    for (var i = 0; i < result.length; i++) {
                        unspent.push(result[i]);
                    }
                    // unspent=result;
                },
                error: function(data) {
                    console.log(data);
                }
            });
            return unspent;
        }
        getWallets() {
            let wallets = localStorage.wallets;
            let showWallets = new Array();
            if (wallets != undefined && wallets != '') {
                let arr = JSON.parse(wallets);
                if (arr.length != 0) {
                    let usarr = new Array();
                    for (var i = 0; i < arr.length; i++) {
                        let address = arr[i].address;
                        let name = arr[i].name;
                        let ciphertext = arr[i].ciphertext;
                        let allassets = this.getUnspent(address);
                        let show = createShowObj(name, address, allassets, ciphertext, ciphertext != undefined && ciphertext != '' ? true : false);
                        showWallets.push(show);

                    }
                }
            }
            return showWallets;
        }
    }
    let walletUtil = new Wallet();
    // VerifyAddress
    let walletList = new WalletList();

    var vm = new Vue({
        el: '#app',
        data: {
            newWallet: {
                id: '',
                name: '',
                allassets: [{ assetid: '', name: '小蚁股', list: [], balance: 0 }, { assetid: '', name: '小蚁币', list: [], balance: 0 }],
                address: '',
                currency: '',
                number: 0,
                ciphertext: '',
                password: '',
                password1: ''
            },
            wallets: walletList.getWallets(),
            loginData: {
                walletIndex: 0,
                ciphertext: '',
                password: ''
            },
            alertMessage: "",
            businessMessage: {
                toAddress: '',
                amount: 0,
                publickeyEncoded: '',
                privatekey: '',
                account: {}
            },
            showAddress: 'false',
            showManipulate: 'false',
            deleteData: {
                index: 0,
                address: ''
            }
        },
        methods: {
            //展示操作
            showAction: function($index) {
                var index = "" + $index;
                if (this.showManipulate == index)
                    this.showManipulate = 'false';
                else
                    this.showManipulate = index;
            },
            //展开或缩小地址
            addressModel: function($index) {
                var index = $index;
                this.showAddress = index;
            },
            //新建
            createWallet: function() {
                // this.wallets.push(this.newWallet);
                // alert(this.newWallet.address);
                let walletObj = {
                    name: '',
                    allassets: new Array(),
                    showAddress: '',
                    hideAddress: '',
                    ciphertext: '',
                    ifPrivate: false
                }

                if (this.newWallet.password != "" && this.newWallet.password != undefined) {
                    let privateKey = Wallet.getPrivateKeyFromWIF(this.newWallet.address);
                    let password = this.newWallet.password;
                    // Wallet.generateWalletFileBlob(wif,this.newWallet.password)
                    if (privateKey == -1 || privateKey == -2) {
                        this.alertMessage = "校验失败，请输入正确的WIF";
                        $('#createPassword').modal('hide');
                        $('#alert').modal('show');
                    } else {
                        let encryptData = Wallet.encryptNeodunPrivateKey(this.newWallet.address, password)
                        let address = Wallet.GetAccountsFromPrivateKey(privateKey)[0].address;
                        let allassets = walletList.getUnspent(address);
                        walletObj.address = address;
                        walletObj.ciphertext = encryptData;
                        // $('#createPassword').modal('show');    
                        if (walletList.addWallet(walletObj)) {
                            let objShow = createShowObj('', address, allassets, encryptData, true);
                            this.wallets.push(objShow);
                            this.alertMessage = "WIF导入成功";
                            $('#createPassword').modal('hide');
                            $('#alert').modal('show');
                        }
                    }
                } else if (Wallet.VerifyAddress(this.newWallet.address)) {
                    // console.log("地址正确");
                    // let num = walletList.getUnspent(this.newWallet.address);
                    // walletObj.number = num;     
                    walletObj.address = this.newWallet.address;
                    walletObj.allassets = walletList.getUnspent(this.newWallet.address);
                    if (walletList.addWallet(walletObj)) {
                        let objShow = createShowObj('', walletObj.address, walletObj.allassets, '', false);
                        this.wallets.push(objShow);
                        this.alertMessage = "地址导入成功";
                        $('#createWallet').modal('hide');
                        $('#alert').modal('show');
                    }
                } else {
                    this.alertMessage = "请输入正确地址";
                    $('#createWallet').modal('hide');
                    $('#alert').modal('show');
                }
                // 添加完newWallet对象后，重置newWallet对象
                this.newWallet = {
                    id: '',
                    name: '',
                    allassets: [],
                    address: '',
                    currency: '',
                    number: 0,
                    ciphertext: '',
                    password: '',
                    password1: ''
                }
            },
            deleteWallet: function() {
                // 删一个数组元素
                if (walletList.deleteWallet(this.deleteData.index)) {
                    this.wallets.splice(this.deleteData.index, 1);
                    this.alertMessage = "删除成功";
                    $('#deleteAddress').modal('hide');
                    $('#alert').modal('show');
                }
            },
            openLogin: function($index) {
                let index = $index;
                this.loginData.walletIndex = index;
                $('#businessOpen').modal('show');
            },
            loginWallet: function() {
                let index = this.loginData.walletIndex;
                let ciphertext = this.wallets[index].ciphertext;
                let wif = Wallet.decryptNeodunPrivateKey(ciphertext, this.loginData.password);
                let privateKey = Wallet.getPrivateKeyFromWIF(wif);
                this.businessMessage.publickeyEncoded = Wallet.getPublicKey(privateKey, true);
                if (privateKey == -1 || privateKey == -2) {
                    $('#loginWallet').modal('hide');
                    this.alertMessage = "密码错误请重新输入";
                    $('#alert').modal('show');
                } else {
                    this.businessMessage.privatekey = privateKey;
                    $('#loginWallet').modal('hide');
                    this.alertMessage = "登录成功，开始交易吧";
                    $('#businessAlert').modal('show');

                }
            },
            //交易
            business: function() {
                this.businessMessage.account = this.wallets[this.loginData.walletIndex].allassets[0];
                console.log(this.businessMessage);
                $('#businessOpen').modal('hide');
                $('#loginWallet').modal('show');
                // $('#businessMessage').modal('show');
            },
            SignTxAndSend: function() {
                var txData = transferTransactionUnsigned(this.businessMessage)
                var publicKeyEncoded = this.businessMessage.publickeyEncoded;
                var privateKey = this.businessMessage.privatekey;
                var sign = Wallet.signatureData(txData, privateKey);
                var txRawData = Wallet.AddContract(txData, sign, publicKeyEncoded);
                // console.log("txRawData:" + txRawData)
                $('#businessAlert').modal('hide');
                $('#loader').modal('show');
                this.sendTransactionData(txRawData);
            },
            /**
             * 广播签名
             * @param {*签名数据}  
             */
            sendTransactionData: function($txData) {
                var alertMessage = this.alertMessage;
                $.ajax({
                    url: "http://47.92.143.199:20332",
                    type: 'POST',
                    data: '{"jsonrpc": "2.0", "method": "sendrawtransaction", "params": ["' + $txData + '"], "id": 4}',
                    async: true,
                    success: function(result) {
                        // Do something with the result
                        $('#businessAlert').modal('hide');
                        // console.log("result:" + JSON.stringify(result));
                        if (result["result"]) {
                            this.alertMessage = "交易成功";
                            $('#alert').modal('show');
                        } else {
                            this.alertMessage = "交易失败，请重试";
                            $('#alert').modal('show');
                        }
                        // unspent=result;
                    },
                    error: function(data) {
                        // console.log("erro:" + JSON.stringify(data));
                        $('#businessAlert').modal('hide');
                        this.alertMessage = '交易异常,请稍后再试';
                        $('#alert').modal('show');
                    }
                })
            }
        }
    });


    //或缺的传输数据
    function getTransferTxData($txData) {
        var ba = new Buffer($txData, "hex");
        var tx = new Transaction();

        // Transfer Type
        if (ba[0] != 0x80) return;
        tx.type = ba[0];

        // Version
        tx.version = ba[1];

        // Attributes
        var k = 2;
        var len = ba[k];
        for (i = 0; i < len; i++) {
            k = k + 1;
        }

        // Inputs 
        k = k + 1;
        len = ba[k];
        for (i = 0; i < len; i++) {
            tx.inputs.push({ txid: ba.slice(k + 1, k + 33), index: ba.slice(k + 33, k + 35) });
            //console.log( "txid:", tx.inputs[i].txid );
            //console.log( "index:", tx.inputs[i].index );
            k = k + 34;
        }

        // Outputs 
        k = k + 1;
        len = ba[k];
        for (i = 0; i < len; i++) {
            tx.outputs.push({ assetid: ba.slice(k + 1, k + 33), value: ba.slice(k + 33, k + 41), scripthash: ba.slice(k + 41, k + 61) });
            //console.log( "outputs.assetid:", tx.outputs[i].assetid );
            //console.log( "outputs.value:", tx.outputs[i].value );
            //console.log( "outputs.scripthash:", tx.outputs[i].scripthash );
            k = k + 60;
        }

        return tx;
    };

    transferTransactionUnsigned = function($message) {
        var reg = /^[0-9]{1,19}([.][0-9]{0,8}){0,1}$/;
        var r = $message.amount.match(reg);
        var alertMessage = "";
        if (r == null) {
            alertMessage = "数额格式检查失败请重新输入";
            // $('#alert').modal('show');
            alert(alertMessage);
            return false;
        }
        if ($message.amount <= 0) {
            alertMessage = "数额必须大于零";
            alert(alertMessage);
            return false;
        }
        if (parseFloat($message.account.balance) < parseFloat($message.amount)) {
            alertMessage = "余额不足";
            alert(alertMessage);
            return false;
        }
        var publicKeyEncoded = $message.publickeyEncoded;
        var txData = Wallet.TransferTransaction(
            $message.account, publicKeyEncoded, $message.toAddress, $message.amount);
        if (txData == -1) {
            alertMessage('地址验证失败。');
            alert(alertMessage);
            return false;
        }

        // $scope.txUnsignedData = txData;
        return txData;
    }