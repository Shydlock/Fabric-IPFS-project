var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');

var channelid = "cc_sendhashtofabric";
var tempdir = "./caconfig/nodejs/fabric_sdk_node/fabric-client-kvs";

var channelmap = {};
var peermap = {};
var channelpeer = {};

let client = new hfc();
var channel = getchannel(channelid);
var order1 = client.newOrderer('grpc://172.27.43.200:7050');
var order2 = client.newOrderer('grpc://172.27.34.202:7050');
var order3 = client.newOrderer('grpc://172.27.34.203:7050');
channel.addOrderer(order1);
channel.addOrderer(order2);
channel.addOrderer(order3);

var peer3 = client.newPeer('grpc://172.27.43.203:7051');

setupchannel(channel,peer3,channelid,"peer3");
peermap["peer3"] = peer3;



/**
 * 查询交易
 * @param chaincodeid
 * @param func
 * @param chaincode_args
 * @returns {Promise<TResult>}
 */
var queryCc = function (chaincodeid , func , chaincode_args ) {

    return getOrgUser4Local().then(( user )=>{

        var tx_id = client.newTransactionID();
        var request = {
            chaincodeId: chaincodeid,
            txId: tx_id,
            fcn: func,
            args: chaincode_args
        };

        return  channel.queryByChaincode( request , peer3 );

    } ,(err)=>{

        console.log('error', err);

    } ).then(( sendtransresult )=>{

        return sendtransresult;

    },(err)=>{
        console.log('error', err);
    });

}


/**
 *  发起一笔交易
 *
 *  @returns {Promise.<TResult>}
 */
var sendTransaction = function ( chaincodeid , func , chaincode_args   ) {
    var transactionID;
    var tx_id = null;
    return getOrgUser4Local().then((user)=>{
        tx_id = client.newTransactionID();
        var request = {
            chaincodeId: chaincodeid,
            fcn: func,
            args: chaincode_args,
            chainId: channelid,
            txId: tx_id
        };
        return channel.sendTransactionProposal(request);
    } ,(err)=>{
        console.log('error', err);
    } ).then((chaincodeinvokresult )=>{

        var proposalResponses = chaincodeinvokresult[0];
        var proposal = chaincodeinvokresult[1];
        var header = chaincodeinvokresult[2];
        var all_good = true;

        for (let i in proposalResponses) {

            let one_good = false;
            if (proposalResponses && proposalResponses[0].response &&
                proposalResponses[0].response.status === 200) {
                one_good = true;
                console.info('transaction proposal was good');
            } else {
                console.error('transaction proposal was bad');
            }
            all_good = all_good & one_good;
        }

        if (all_good) {

            console.info(util.format(

                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
                proposalResponses[0].response.status, proposalResponses[0].response.message,
                proposalResponses[0].response.payload, proposalResponses[0].endorsement
                    .signature));

            var request = {
                proposalResponses: proposalResponses,
                proposal: proposal,
                header: header
            };
            // set the transaction listener and set a timeout of 30sec
            // if the transaction did not get committed within the timeout period,
            // fail the test
            transactionID = tx_id.getTransactionID();

            return channel.sendTransaction(request);
        }

    },(err)=>{
        console.log('error', err);
    }).then(( sendtransresult )=>{
        if(sendtransresult){
            sendtransresult.txid = transactionID;
        }
        return sendtransresult;  // 链码真实返回的信息

    },(err)=>{
        console.log('error', err);
        return err;

    });
}

/**
 *
 * 根据cryptogen模块生成的账号通过Fabric接口进行相关的操作
 *
 * @returns {Promise.<TResult>}
 *
 */
function getOrgUser4Local() {

    //测试通过CA命令行生成的证书依旧可以成功的发起交易
    let keyPath = "./caconfig/keystore";
    let keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
    let certPath = "./caconfig/signcerts";
    let certPEM = readAllFiles(certPath)[0].toString();


    return hfc.newDefaultKeyValueStore({

        path:tempdir

    }).then((store) => {
        client.setStateStore(store);

        return client.createUser({
            username: 'Admin',
            mspid: 'Org1MSP',
            cryptoContent: {
                privateKeyPEM: keyPEM,
                signedCertPEM: certPEM
            }
        });
    });
}

function readAllFiles(dir) {
    var files = fs.readdirSync(dir);
    var certs = [];
    files.forEach((file_name) => {
        let file_path = path.join(dir,file_name);
        let data = fs.readFileSync(file_path);
        certs.push(data);
    });
    return certs;
}

/**
 *
 * @param _tempdir
 * @param _admin_key
 * @param _admin_sert
 */
var inits = function ( _tempdir , _admin_key , _admin_sert ) {
    tempdir  = _tempdir;
    admin_key = _admin_key;
    admin_sert = _admin_sert;
}

/**
 *
 * @param channelid
 * @param peerRequest
 * @returns {Promise<TResult>}
 */
var getBlockChainInfo = function( channelid , peerRequest ){

    let channel = getchannel(channelid);
    let  peer = getpeer(peerRequest);

    setupchannel(channel,peer,channelid,peerRequest);

    return getOrgUser4Local().then((user)=>{

        return channel.queryInfo(peer);

    } ,(err)=>{

        console.log( 'error' , err );
    } )

}

/**
 *  根据区块链的编号获取区块的详细信息
 *
 * @param blocknum
 * @returns {Promise.<TResult>}
 *
 */
var getblockInfobyNum = function (channelid , peerRequest ,blocknum) {

    let channel = getchannel(channelid);
    let  peer = getpeer(peerRequest);


    setupchannel(channel,peer,channelid,peerRequest);


    return getOrgUser4Local().then((user)=>{

        return channel.queryBlock(blocknum, peer,null);

    } ,(err)=>{
        console.log( 'error' , err);
    } )

}

/**
 *  根据区块链的哈希值获取区块的详细信息
 *
 * @param blocknum
 * @returns {Promise.<TResult>}
 *
 */
var getblockInfobyHash = function ( channelid , peerRequest , blockHash ) {

    let channel = getchannel(channelid);
    let  peer = getpeer(peerRequest);
    setupchannel(channel,peer,channelid,peerRequest);

    return getOrgUser4Local().then(( user )=>{

        return channel.queryBlockByHash(new Buffer(blockHash,"hex"),peer)

    } ,(err)=>{

        console.log('error', err);

    } )

}



/**
 *
 *  获取当前Peer节点加入的通道信息
 *
 *  @param blocknum
 *  @returns {Promise.<TResult>}
 *
 */
var getPeerChannel = function ( peerRequest  ) {


    let  peer = getpeer(peerRequest);

    return getOrgUser4Local().then(( user )=>{

        return client.queryChannels(peer)

    } ,(err)=>{

        console.log('error', err);
    } )

}

/**
 *
 *  查询指定peer节点已经install的chaincode
 *
 *  @param blocknum
 *  @returns {Promise.<TResult>}
 *
 */
var getPeerInstallCc = function (  peerRequest  ) {

    let  peer = getpeer(peerRequest);

    return getOrgUser4Local().then(( user )=>{

        return client.queryInstalledChaincodes(peer)

    } ,(err)=>{

        console.log('error', err);
    } )

}

/**
 *
 *  查询指定channel中已经实例化的Chaincode
 *
 *  @param blocknum
 *  @returns {Promise.<TResult>}
 *
 */
var getPeerInstantiatedCc = function ( channelid , peerRequest ) {

    let channel = getchannel(channelid);
    let  peer = getpeer(peerRequest);
    setupchannel(channel,peer,channelid,peerRequest);

    return getOrgUser4Local().then(( user )=>{

        return channel.queryInstantiatedChaincodes( peer )

    } ,(err)=>{

        console.log('error', err);

    } )

}


var  getTransaction = function (channelid , peerRequest ,transhash) {

    let channel = getchannel(channelid);
    let  peer = getpeer(peerRequest);
    setupchannel(channel,peer,channelid,peerRequest);

    return getOrgUser4Local().then( (user)=>{

        return channel.queryTransaction(transhash, peer);

    },(err)=>{
        console.log('error',err);
    })

}

function getchannel( channel_id ) {

    if( channelmap[channel_id] == null){
        let channel = client.newChannel(channel_id);
        channelmap[channel_id]=channel;
    }
    return channelmap[channel_id];
}


function getpeer(peerRequest) {

    if( peermap[peerRequest] == null){
        let  peer = client.newPeer(peerRequest);
        peermap[peerRequest]=peer;
    }

    return peermap[peerRequest];
}


function setupchannel( channel1, peer ,channel_id , peer_request) {

    let pkey = channel_id + peer_request;

    if( channelpeer[pkey] == null ){
        channel1.addPeer(peer);
        channelpeer[pkey] = peer;
    }
}

exports.inits = inits;
exports.getBlockChainInfo = getBlockChainInfo;
exports.getblockInfobyNum = getblockInfobyNum;
exports.getblockInfobyHash = getblockInfobyHash;
exports.getPeerChannel = getPeerChannel;
exports.getPeerInstallCc = getPeerInstallCc;
exports.getPeerInstantiatedCc = getPeerInstantiatedCc;
exports.getTransaction = getTransaction;
exports.sendTransaction = sendTransaction;
exports.queryCc = queryCc;