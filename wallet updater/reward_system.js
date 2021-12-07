// REWARD SYSTEM - SCRIPT1  [ myscript.js + myscript1_1.js ]
/* REQUIREMENT
*Incentive system overview*

There will be 2 scrips.. 

Script 1:
=> this node.js script fetches all transactions from block.. 
And then filter out all the transactions as smart contract calls 
(all normal DTH transfer transactions will be ignored, only smart contracts calls transactions will be considered)

=> Lets say you got 10 smart contract transactions.. 
 Then loop through all the txns and find (1) contract address (2) contract deployer wallet
  (3) referrer wallet from contract.. We can store this data in DB,
   so we don't have to query blockchain all the time.. (4) transaction fee of that contract call. 

=> once you have all those data, then save them in the database.
 Every deployer wallet and their commission amount 
 (which will be 50% of trx fee for deployer and 10% of txn fee for referrer).
  Increment this amounts for every transaction of that particular contract deployer and contract referrer. 
*/

var mysql = require('mysql');
require('dotenv').config();
const Web3 = require("web3");
var EXCLUDE_THESE = ['Transfer'];
const util = require('util');

var DB_CONFIG = {
  		host: process.env.DB_HOST.toString(),
  		user: process.env.DB_USER.toString(),
  		password: process.env.DB_PASSWORD.toString(),
  		database: process.env.DB_DATABASE.toString(),  
 		connectTimeout: 100000, 				
  		port:process.env.PORT
}


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

var mydata = [];
//process.env.script1LBN = 12189105;

async function getmyblock(BlokNum){
	var _dt = new Date();
	var _dt_timestamp = _dt.getTime();
	console.log(">> In get my block: _dt_timestamp, BlokNum", _dt_timestamp, BlokNum);	
	try{
		var myblk = await web3.eth.getBlock(parseInt(BlokNum));
		if(myblk){		
			mydata[myblk.number] = myblk;
			console.log("Inserting in database>>><<<< MY BLK NUMBER >>>>",myblk.number);
			console.log("<<<< MY BLK >>>>",myblk);
			var myvar = await db_insert(myblk.number, myblk);
		}
		await lastBlockWorked(process.env.script1LBN);
		process.env.script1LBN = parseInt(process.env.script1LBN) +1;
		setTimeout(()=>{},10000);		
		await getmyblock(process.env.script1LBN);		
	}catch(e){
		console.log("ERROR CATCHED >>>",e);
		await getmyblock(BlokNum);	
	}
}

// FIRST time will execute this, will give "latest" block
web3.eth.getBlockNumber().then(a => {
	process.env.script1LBN = parseInt(a);
	//console.log("process.env.script1LBN >>>>> ",process.env.script1LBN);
	(async()=>{	
		await getmyblock(process.env.script1LBN);
	})();
});


async function	db_query(_sql, _querytype){
	var con = mysql.createConnection(DB_CONFIG);	
	con.connect(function(err) {
  		if (err) { console.log("Error DB connect:",err); }
	  	console.log("Connected to dithereum database:");  	
	  	console.log(">>> QueryType <<<", _sql,">>>>", _querytype);   
	  	con.query(_sql, function (err, result) {	  		
	  		setTimeout(()=>{console.log("<<QUERY>>",_sql); },10000);
    		if(err){ console.log("Error Occured:", err); }
    		else{
    			console.log("Query Executed >>",_querytype);
    			con.end();    			    			
    		}
  		});  		  	
	});	
}


async function	db_insert(blknumber, blk){	
  	var sql = "INSERT INTO "+process.env.DB_SCRIPT_BLOCKS_TABLE+" (blknumber, blk) VALUES ("+blknumber+",'"+JSON.stringify(blk)+"')";  	
	console.log("<@ SQL @>",sql);  	
  	return db_query(sql, "InsertQuery");
}

async function lastBlockWorked(_lastBlocknumber){	
  	_lastBlocknumber = _lastBlocknumber ? _lastBlocknumber : 0; 
  	var sql = "UPDATE "+process.env.DB_LASTBLOCK_TABLE+" SET blockid="+_lastBlocknumber+" LIMIT 1";
  	console.log("<<< SQL >>>",sql);
  	return db_query(sql, "UpdateQuery");  	
}


let web31 = new Web3(getHTTPprovider());
let web32 = new Web3(getHTTPprovider());
let web33 = new Web3(getHTTPprovider());

async function getTransaction(){
	await db_select().then(z=>{				
		var mydata = [];
		if(z.length >0){
			mydata[z[0].blknumber] = z[0].blk.toString('utf8');	
			//console.log(mydata[z[0].blknumber]);		
			if(mydata[z[0].blknumber]){
				getBlocksAllTransaction(z[0].blknumber, mydata[z[0].blknumber]);		
			}
		}else{			
			setTimeout(()=>{
				getTransaction();			
			}, 10000);			
		}
	});	
}

getTransaction();


async function getBlocksAllTransaction(num, trans){
	console.log(">>>> Block Number >>>",num);
	var _ary = [];
	_ary = JSON.parse(trans).transactions;
	console.log("ARY_LENGTH >>>",_ary.length);
	if(_ary.length == 0){
		db_delete(num);
	}
	for(i=0; i<_ary.length -1; i++){
			try{		
					console.log("getting transactions");
					setTimeout(()=>{}, 6000); 					
					await getTransactionDetails(_ary[i]);
					setTimeout(()=>{}, 2000);		
					if(i === (_ary.length-2)){
						console.log(">>>>Deleting Block>>>>", num);
						db_delete(num);		
					}			
			}catch(e){
				console.log("<<< Exception >>>",e);
			}
	}	
}


// Working code .. //0xcbae1483180c2ae7b33457024e278cfe8dee34c2adcde8786c905a20d51bb2fa
async function getTransactionDetails(q){		
	console.log("GETTING FOR  >>>>",q);	
	await web31.eth.getTransaction(q).then((z)=>{				
		/// IF in to:null means is Contract creation	
		if(z.to === null){
			var _usersGasPrice = parseInt(z.gasPrice);
			(async ()=>{		
					await web32.eth.getTransactionReceipt(q).then((x)=>{						
						// i considered _referrer_addr empty					
						var _referrer_addr = '';
						var _deployer_addr = x.from;
						var _blockNumber = x.blockNumber;			
						var _transaction_fees_wei = _usersGasPrice * parseInt(x.gasUsed.toString());										
						//console.log("Transction Fees Wei >>>>", _transaction_fees_wei);
						(async ()=>{											
							var _transaction_fees_eth = await web33.utils.fromWei(_transaction_fees_wei.toString(), 'ether');
							//console.log("Transction Fees Ethers, _deployer_addr, _blockNumber >>>>", _transaction_fees_eth,_deployer_addr, _blockNumber );
							var _contractAddress = x.contractAddress;							
							await db_insert1(_contractAddress, _blockNumber, _deployer_addr, _transaction_fees_eth, _referrer_wallet='--', q);				
							await commission_insert(_transaction_fees_eth, _contractAddress, _deployer_addr, _referrer_addr);
						})();				
					}).catch((e)=>{
						console.log("Error, CATCH >>>>",e);
					})
			})();						
		}		
	}).catch((e)=>{
		console.log("CATCH>>><<<<q",q);
		console.log("Error, catch >>>",e);
	})	
}

async function	db_promisify(_sql, _querytype){	
	var con = mysql.createConnection(DB_CONFIG);
	const query = util.promisify(con.query).bind(con);	
	try{
			console.log("db_promisify >> Query Type >>", _querytype);
			return await query(_sql);					
	}catch(e){
		console.log("ERROR >>Catch",e);
	}finally{
			con.end();			
	}			
}

async function	db_select(){	
	return await db_promisify("SELECT * FROM "+process.env.DB_SCRIPT_BLOCKS_TABLE+" limit 0,1", "SelectQuery");				
}

async function commission_insert(_transaction_fees_eth, _contractAddress, deployer_addr, _referrer_addr){	
	var mycommission_con = mysql.createConnection(DB_CONFIG);
	const insertquery = util.promisify(mycommission_con.query).bind(mycommission_con);
	const selectquery = util.promisify(mycommission_con.query).bind(mycommission_con);	
	const updatequery = util.promisify(mycommission_con.query).bind(mycommission_con);	
	
	const insertquery1 = util.promisify(mycommission_con.query).bind(mycommission_con);
	const selectquery1 = util.promisify(mycommission_con.query).bind(mycommission_con);	
	const updatequery1 = util.promisify(mycommission_con.query).bind(mycommission_con);
	
	try{				
			var deployer_commission = (parseFloat(_transaction_fees_eth) / 100) * 50;
			//console.log("_transaction_fees_eth, deployer_commission >>>",_transaction_fees_eth, deployer_commission);			
			
			// DEPLOYER COMMISSION INSERT/UPDATES
			var _SELECT_SQL = "SELECT deployer_commission, _deployer_wallet  from  "+process.env.DB_SCRIPT1_DEPLOYER_COMMISSION_TABLE+" where _deployer_wallet like '"+deployer_addr+"'";
			var _result = await selectquery(_SELECT_SQL);
			console.log("#### _SELECT_SQL ####",_SELECT_SQL);
			if(_result.length > 0){
				var _new_commission = _result[0].deployer_commission + deployer_commission;				
				_UPDATE_SQL = "UPDATE "+process.env.DB_SCRIPT1_DEPLOYER_COMMISSION_TABLE+" SET deployer_commission = "+_new_commission+" where _deployer_wallet like '"+deployer_addr+"'";
				console.log("#### _UPDATE_SQL ####", _UPDATE_SQL);
				var _res = await updatequery(_UPDATE_SQL);  
			}else{
				var _INSERT_SQL = "INSERT INTO "+process.env.DB_SCRIPT1_DEPLOYER_COMMISSION_TABLE+" (deployer_commission, _deployer_wallet) VALUES ("+deployer_commission+",'"+deployer_addr+"')";
				console.log("#### _INSERT_SQL #####",_INSERT_SQL);
				var _res = await updatequery(_INSERT_SQL);				
			}													
			
			// REFERRER COMMISSION INSERT/UPDATED  
			var referrer_commission = 0;
			if(_referrer_addr){
				referrer_commission = (parseFloat(_transaction_fees_eth) / 100) * 10;			
				var _SELECT_SQL1 = "SELECT referrer_commission,_referrer_wallet  from  "+process.env.DB_SCRIPT1_REFERRER_COMMISSION_TABLE+" where _referrer_wallet like '"+_referrer_addr+"'";
				console.log(">>>> SELECT SQL >>>>", _SELECT_SQL1);			
				var _result1 = await selectquery1(_SELECT_SQL1);
				if(_result1.length > 0){
					var _new_commission1 = _result1[0].referrer_commission + referrer_commission;				
					_UPDATE_SQL1 = "UPDATE "+process.env.DB_SCRIPT1_REFERRER_COMMISSION_TABLE+" SET referrer_commission = "+_new_commission1+"  where _referrer_wallet like '"+_referrer_wallet+"'";				
					var _res1 = await updatequery1(_UPDATE_SQL1);
					console.log(">>>> Update SQL >>>>", _UPDATE_SQL1);  
				}else{
					var _INSERT_SQL1 = "INSERT INTO "+process.env.DB_SCRIPT1_REFERRER_COMMISSION_TABLE+" (referrer_commission, _referrer_wallet) VALUES ("+referrer_commission+",'"+_referrer_addr+"')";
					var _res1 = await updatequery1(_INSERT_SQL1);				
					console.log(">>>> Insert SQL >>>>", _INSERT_SQL1);
				}	
			}			
	}catch(e){
		console.log("ERROR >>Catch",e);
	}finally{
		mycommission_con.end();			
	}			
}

async function	db_insert1(_contractAddress, _blockNumber, _deployer_addr, _transaction_fees_eth, _referrer_wallet, q){
		var insertsql = "INSERT INTO "+process.env.DB_SCRIPT1_TABLE+" (contract_address, block_num, deployer_addr, trans_fee, referrer_wallet) VALUES ('"+_contractAddress+"',"+_blockNumber+",'"+_deployer_addr.toString()+"','"+_transaction_fees_eth.toString()+"','"+_referrer_wallet.toString()+"')";
		console.log("<<< INSERTING >>>",insertsql);		
		return await db_promisify(insertsql,"InsertQuery");		
}


async function	db_delete(_blockNumber){
		var deletesql = "DELETE FROM "+process.env.DB_SCRIPT_BLOCKS_TABLE+" where blknumber="+_blockNumber;
		console.log("<<< DELETING >>>", deletesql);			
		var m = await db_promisify(deletesql,"deletequery");			
		getTransaction();		
}