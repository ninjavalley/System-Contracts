/*
/// REQUIREMENT 
Script 2:
=> this will run every 10 minutes and fetch all the positive value wallets with their amounts.. 
=> Make an array of addresses and amounts and send to smart contract.. 
=> array length must not exceeds smart contracts limit.. If array is lengthy, then.. 
It will take specidied entries only.. 
Please check in the contract that, how much maximum array length is allowed in contract. 
=> then make zero value of all those records..
*/

var mysql = require('mysql');
require('dotenv').config();
const Web3 = require("web3");
var Tx = require('ethereumjs-tx').Transaction;
var EXCLUDE_THESE = ['Transfer']
const util = require('util');
var cron = require('node-cron');
var MY_INFURA_URL = "https://ropsten.infura.io/v3/c5147069a6de4315aed6494e1fa53266";
var CHAIN = {'chain':'ropsten'}

var WALLET_NONCE_COUNT = []; // to keep track for nonce  
var LAST_WALLET_INDEX = 0; 
var BRIDGE_ADMIN_WALLET_ARY = process.env.BRIDGE_ADMIN_WALLET_ARY.split(','); 
var BRIDGE_ADMIN_WALLET_ARY_PK = process.env.BRIDGE_ADMIN_WALLET_ARY_PK.split(',');
//console.log(">>>>>>>", BRIDGE_ADMIN_WALLET_ARY);
//console.log(">>>>>>>", BRIDGE_ADMIN_WALLET_ARY_PK);
var max_admin_wallets = BRIDGE_ADMIN_WALLET_ARY.length; 
console.log(">>>>>>>", max_admin_wallets, BRIDGE_ADMIN_WALLET_ARY_PK.length);

const options = {
    timeout: 30000,
    reconnect: {
      auto: true,
      delay: 5000,
      maxAttempts: 10,
      onTimeout: true,
    },
    clientConfig: {
      keepalive: true,
      keepaliveInterval: 60000,
      maxReceivedFrameSize: 100000000,
      maxReceivedMessageSize: 100000000,
    },
};

var getHTTPprovider = () =>{
	 var httpprovider = new Web3(new Web3.providers.HttpProvider(process.env.COMPANY_CONTRACT_URL, options));     
    return httpprovider
}

let web3 = new Web3(getHTTPprovider());

var lastBlockNumber = 0;
// script1 last block number fetched

async function	db_select_deployer_commission(){	
	var con = mysql.createConnection({
  		host: process.env.DB_HOST.toString(),
  		user: process.env.DB_USER.toString(),
  		password: process.env.DB_PASSWORD.toString(),
  		database: process.env.DB_DATABASE.toString(),
  		connectTimeout: 100000,
  		port:3306  		
	});
	const query = util.promisify(con.query).bind(con);	
	try{
			//return await query("SELECT total_deployer_commission, deployer_addr FROM COMMISSION_VIEW where deployer_addr IS NOT NULL AND total_deployer_commission >0 limit 0,5");
			return await query("SELECT deployer_commission as total_deployer_commission, _deployer_wallet as deployer_addr FROM  script1_deployer_commission  where _deployer_wallet IS NOT NULL AND deployer_commission >0 limit 0,5");					
		}finally{
			con.end();			
	}			
}

async function	db_select_referrer_commission(){	
	var con = mysql.createConnection({
  		host: process.env.DB_HOST.toString(),
  		user: process.env.DB_USER.toString(),
  		password: process.env.DB_PASSWORD.toString(),
  		database: process.env.DB_DATABASE.toString()
	});
	const query = util.promisify(con.query).bind(con);	
	try{
			return await query("SELECT referrer_commission as total_referrer_commission, _referrer_wallet as referrer_addr FROM script1_referrer_commission  where _referrer_wallet IS NOT NULL AND referrer_commission >0 limit 0,5");							
		}finally{
			con.end();			
	}			
}

async function removefrom_delployer_commssion_table(removeary){
	var con3 = mysql.createConnection({
  		host: process.env.DB_HOST.toString(),
  		user: process.env.DB_USER.toString(),
  		password: process.env.DB_PASSWORD.toString(),
  		database: process.env.DB_DATABASE.toString()
	});
	const query3 = util.promisify(con3.query).bind(con3);					
		for(i=0;i<removeary.length;i++){			
			var _subamt = parseFloat(removeary[i][Object.keys(removeary[i])]);
			var commission_sql = "UPDATE script1_deployer_commission SET deployer_commission=deployer_commission-"+_subamt+" where _deployer_wallet='"+Object.keys(removeary[i])+"'";
			console.log("UPDATE SQL >>>",commission_sql);
			try{				
				await query3(commission_sql);							
			}finally{			
				// console.log("Do nothing here");
			}
			if(i == removeary.length){
				con3.end();			
			}				
		}
}

/*
db_select_deployer_commission().then((z)=>{
	var _deployerary = [];
	var _commissionary = [];
	z.forEach((zz)=>{	
		_deployerary.push(zz.deployer_addr);
		_commissionary.push(zz.total_deployer_commission * 1000000000000000000);
		//console.log("ZZZZZZ>>>>",zz.total_deployer_commission);
		//console.log("ZZZZZZ>>>>",zz.deployer_addr);
	});
	if(_deployerary.length > 0){
		company_bridge_send_method(_deployerary, _commissionary);
	}
})
*/

/*
async function company_bridge_send_method(_walletary, _commissionary){
	 console.log("_walletary[0],_commissionary[0] >>>>", _walletary[0],_commissionary[0]);      
    let bridgeweb3 = new Web3(new Web3.providers.HttpProvider(MY_INFURA_URL));
    bridgeweb3.eth.handleRevert = true;                                
    const company_bridgeinstance = new bridgeweb3.eth.Contract(JSON.parse(process.env.ROPSTEN_COMPANY_BRIDGE_ABI), process.env.ROPSTEN_COMPANY_BRIDGE_ADDR);
    /// NOTE ----
    // HERE I took First Ary Element using [0] index as sample call, Note -Change it to ary     
    try{
    	var mydata = company_bridgeinstance.methods.returnCoin(_walletary[0].toString(),_commissionary[0].toString()).encodeABI();
      var requiredGas = await company_bridgeinstance.methods.returnCoin(_walletary[0].toString(),_commissionary[0].toString()).estimateGas({from: process.env.BRIDGE_ADMIN_WALLET.toString()});
    }catch(e){
    	console.log("EEEE>>>>",e);
    }    
    //console.log("MYDATA >>>>",mydata);       
    //console.log(">>>>> REQUIRED GAS <<<<<",requiredGas);           
        bridgeweb3.eth.getTransactionCount(process.env.BRIDGE_ADMIN_WALLET,"pending").then((mynonce)=>{                            
            (async function(){                       
                    bridgeweb3.eth.getGasPrice().then(gasPrice=>{                                                                 
                            const myrawTx = {   
                                nonce: web3.utils.toHex(mynonce),                    
                                gasPrice: web3.utils.toHex(gasPrice),
                                gasLimit: requiredGas,
                                to: process.env.BRIDGE_ADMIN_WALLET.toString(),                        
                                value: 0x0, 
                                data: mydata                  
                            };                              
                            //console.log("MY RAW TX >>>>>>",myrawTx);                                            
                            var tx = new Tx(myrawTx, CHAIN);
                            var privateKey = Buffer.from(process.env.BRIDGE_CONTRACT_OWNER_PK.toString(), 'hex');
                            tx.sign(privateKey);                        
                            var serializedTx = tx.serialize(); 
                                                                    
                            bridgeweb3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex')).then((receipt)=>{
                                console.log(JSON.stringify(receipt));                                
                            }).catch(error=>{                       
                                console.log(error);              
                            })                                                                                                                      
                    }).catch(e=>{                        
                        console.log("ERRROR >>>>",e);
                    })                    
            })().catch(e=>{                
                console.log("ErrOr >>>>",e);
            })             
        }).catch((e)=>{                        
            console.log("eRRor >>>>",e);
        });             
}
*/

async function company_bridge_send_method(_walletary, _commissionary){
	 console.log("_walletary[0],_commissionary[0] >>>>", _walletary[0],_commissionary[0]);      
    let bridgeweb3 = new Web3(new Web3.providers.HttpProvider(MY_INFURA_URL));
    bridgeweb3.eth.handleRevert = true;                                
    const company_bridgeinstance = new bridgeweb3.eth.Contract(JSON.parse(process.env.ROPSTEN_COMPANY_BRIDGE_ABI), process.env.ROPSTEN_COMPANY_BRIDGE_ADDR);
    /// NOTE ----
    // HERE I took First Ary Element using [0] index as sample call, Note -Change it to ary     
    try{
    	var mydata = company_bridgeinstance.methods.returnCoin(_walletary[0].toString(),_commissionary[0].toString()).encodeABI();
      var requiredGas = await company_bridgeinstance.methods.returnCoin(_walletary[0].toString(),_commissionary[0].toString()).estimateGas({from: process.env.BRIDGE_ADMIN_WALLET.toString()});      
    }catch(e){
    	console.log("EEEE>>>>",e);
    }    
    console.log("MYDATA >>>>",mydata);       
    console.log(">>>>> REQUIRED GAS <<<<<",requiredGas);
    var mynonce = 0;
    var bridge_admin_wallet;
    var bridge_admin_wallet_ary_pk;
    var transcount;
    console.log("<<<< LAST_WALLET_INDEX >>>>",LAST_WALLET_INDEX);
    console.log("<<< max_admin_wallets >>>",max_admin_wallets);
	 if(LAST_WALLET_INDEX === (max_admin_wallets-1)){
	 		bridge_admin_wallet = BRIDGE_ADMIN_WALLET_ARY[0];
	 		bridge_admin_wallet_ary_pk = BRIDGE_ADMIN_WALLET_ARY_PK[0];
			LAST_WALLET_INDEX = 0;			
	 }else{
			var _index = LAST_WALLET_INDEX+1;
			LAST_WALLET_INDEX = _index;
			bridge_admin_wallet = BRIDGE_ADMIN_WALLET_ARY[LAST_WALLET_INDEX];
			bridge_admin_wallet_ary_pk = BRIDGE_ADMIN_WALLET_ARY_PK[LAST_WALLET_INDEX];			
	 }
	 transcount = await bridgeweb3.eth.getTransactionCount(bridge_admin_wallet.toString());
	 var MY_TX_COUNT = WALLET_NONCE_COUNT[bridge_admin_wallet] ? (WALLET_NONCE_COUNT[bridge_admin_wallet]+1) : 0;
	 mynonce = transcount + MY_TX_COUNT;	
	 WALLET_NONCE_COUNT[bridge_admin_wallet] = WALLET_NONCE_COUNT[bridge_admin_wallet]+1;
			   
	 console.log("<<< transcount, MY_TX_COUNT, mynonce >>>", transcount, MY_TX_COUNT, mynonce);
	 console.log("bridge_admin_wallet >>>", bridge_admin_wallet);  
            (async function(){                       
                    bridgeweb3.eth.getGasPrice().then(gasPrice=>{                                                                 
                            const myrawTx = {   
                                nonce: web3.utils.toHex(mynonce),                    
                                gasPrice: web3.utils.toHex(gasPrice),
                                gasLimit: requiredGas,
                                from: bridge_admin_wallet.toString(),
                                to: process.env.ROPSTEN_COMPANY_BRIDGE_ADDR.toString(),                        
                                value: 0x0, 
                                data: mydata                  
                            };
 									                                                         
                            //console.log("MY RAW TX >>>>>>",myrawTx);                                            
                            var tx = new Tx(myrawTx, CHAIN);
                            var privateKey = Buffer.from(bridge_admin_wallet_ary_pk.toString(), 'hex');
									                            
                            tx.sign(privateKey);                        
                            var serializedTx = tx.serialize(); 
                                                                    
                            bridgeweb3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex')).then((receipt)=>{
                                console.log(JSON.stringify(receipt));                                
                            }).catch(error=>{                       
                                console.log(error);              
                            })                                                                                                        
                    }).catch(e=>{                        
                        console.log("ERRROR >>>>",e);
                    })                    
            })().catch(e=>{                
                console.log("ErrOr >>>>",e);
            })
}

cron.schedule('0,10,20,30,40,50 * * * *', () => {
   console.log('Running a task every 10 minute');
	db_select_deployer_commission().then((z)=>{
		var _deployerary = [];
		var _commissionary = [];
		var _removeary = [];
		z.forEach((zz)=>{	
			_deployerary.push(zz.deployer_addr);
			_commissionary.push(zz.total_deployer_commission * 1000000000000000000);			
			console.log("ZZZZZZ>>>>",zz.total_deployer_commission, zz.deployer_addr);			
			var Ob = {};
			Ob[zz.deployer_addr] =  zz.total_deployer_commission.toString();
			_removeary.push(Ob);
		});
		if(_deployerary.length > 0){
			company_bridge_send_method(_deployerary, _commissionary);
			removefrom_delployer_commssion_table(_removeary);			
		}
	})
});


cron.schedule('5,15,25,35,45,55 * * * *', () => {
   console.log('Running a task every 5 minute');
	db_select_referrer_commission().then((z)=>{
		var _referrerary = [];
		var _commissionary = [];
		z.forEach((zz)=>{	
			_referrerary.push(zz.referrer_addr);
			_commissionary.push(zz.total_referrer_commission * 1000000000000000000);			
			console.log("ZZZZZZ>>>>",zz.total_deployer_commission, zz.referrer_addr);			
		});
		if(_referrerary.length > 0){
			company_bridge_send_method(_referrerary, _commissionary);
		}
	})
});