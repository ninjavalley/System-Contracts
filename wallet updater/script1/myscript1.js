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
	console.log(">> In get my block:", _dt_timestamp);
	console.log("<<<< BlokNum >>>>",BlokNum);
	try{
		var myblk = await web3.eth.getBlock(parseInt(BlokNum));
		if(myblk){		
			mydata[myblk.number] = myblk;
			console.log("Inserting in database>>>");
			console.log("<<<< MY BLK NUMBER >>>>",myblk.number);
			console.log("<<<< MY BLK >>>>",myblk);
			db_insert(myblk.number, myblk);
		}
		lastBlockWorked(process.env.script1LBN);
		process.env.script1LBN = parseInt(process.env.script1LBN) +1;		
		setTimeout(()=>{ 
			getmyblock(process.env.script1LBN);
		},12000);
	}catch(e){
		console.log("ERROR CATCHED >>>",e);
		setTimeout(()=>{ getmyblock(BlokNum) }, 4000);	
	}
}

// FIRST time will execute this, will give "latest" block
web3.eth.getBlockNumber().then(a => {
	process.env.script1LBN = parseInt(a);
	//console.log("process.env.script1LBN >>>>> ",process.env.script1LBN);	
	getmyblock(process.env.script1LBN);
});


async function	db_insert(blknumber, blk){
	var con = mysql.createConnection({
  		host: process.env.DB_HOST.toString(),
  		user: process.env.DB_USER.toString(),
  		password: process.env.DB_PASSWORD.toString(),
  		database: process.env.DB_DATABASE.toString()
	});	
	con.connect(function(err) {
  	if (err) { console.log("Error DB connect:",err); }
  	console.log("Connected to dithereum database:");
  	var sql = "INSERT INTO script1_blocks (blknumber, blk) VALUES ("+blknumber+",'"+JSON.stringify(blk)+"')";  	
  	con.query(sql, function (err, result) {
    	if(err){ console.log("Error Occured:", err); }
    		else{
    			console.log("1 record inserted");
    			con.end();    			    			
    		}
  		});  	
	});	
}


async function lastBlockWorked(_lastBlocknumber){
	var con2 = mysql.createConnection({
  		host: process.env.DB_HOST.toString(),
  		user: process.env.DB_USER.toString(),
  		password: process.env.DB_PASSWORD.toString(),
  		database: process.env.DB_DATABASE.toString()
	});	
	con2.connect(function(err) {
  	if (err) { console.log("Error DB connect:",err); }
  	console.log("Connected to dithereum database:");
  	_lastBlocknumber = _lastBlocknumber ? _lastBlocknumber : 0; 
  	var sql = "UPDATE LastBlock SET blockid="+_lastBlocknumber+" LIMIT 1";   	
  	con2.query(sql, function (err, result) {
    	if(err){ console.log("Error Occured:", err); }
    		else{
    			console.log("Record Updated!");
    			con2.end();    			    			
    		}
  		});  	
	});	
}
