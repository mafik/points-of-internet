var http = require('http');
var crypto = require('crypto');
var url = require('url');
var nodemailer = require("nodemailer");
var disposable = require('is-disposable-email');

var db = new (require('sqlite3').Database)('current.db');

db.loadExtension('./libsqlitefunctions.so');

var local_url = "https://pointsof.net/";

var transport = nodemailer.createTransport("sendmail", {path: '/usr/sbin/sendmail'});

function validateSecret(email) { 
  var re = /^[a-zA-Z0-9]{20}$/;
  return re.test(email);
} 

function validateEmail(email) { 
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
} 

function randomSecret() {
  var arr = [];
  var s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for(var i = 0; i < 20; ++i) {
    arr.push(s[Math.floor(Math.random() * s.length)]);
  }
  return arr.join('');
}

var salt = 'pour some salt here';

function digestSecret(secret) {
  return crypto.createHash('sha256').update(salt).update(secret).digest('hex');
}

db.exec("create table if not exists accounts (email text, balance real, date integer, secret text, notify real, last_email integer, primary key (email), unique (secret))", function(err) {
  if(err) {
    console.log(err);
    throw err;
  }
});
db.exec("create table if not exists history (source text, destination text, amount real, comment text, date integer, foreign key (source) references accounts (email), foreign key (destination) references accounts (email))", function(err) {
  if(err) {
    console.log(err);
    throw err;
  }
});

var alpha = 1000 * 3600 * 24 * 50;
var credit = 1000;

function balance(row, now) {
  var d = (now - row.date) / alpha;
  return Math.pow(0.5, d) * row.balance;
}

var update_last_email = db.prepare("UPDATE accounts SET last_email = ? WHERE email = ?");

function sendMail(email, source, amount, comment, secret, callback) {
  update_last_email.run(+new Date, email);

  var link = local_url + '#' + secret;

  var mail = {
    from: source || "Points of Internet <noreply@pointsof.net>",
    to: email,
    text: "",
    html: "<!DOCTYPE html>\n"
  };

  var noun = "Point" + (Math.abs(amount) > 1 ? 's' : '') + ' of Internet';

  if(amount == 0) {
    mail.subject = "Private link generated";
  } else {
    mail.subject = amount + " " + noun;
  }
  if(comment) {
    mail.subject += ": " + comment.replace(/(\r\n|\n|\r)/gm," ").replace(/\s+/g," ").trim();
  }

  mail.html += "<title>" + mail.subject + "</title>";

  mail.html += '<p>';
  if(amount > 0) {
    mail.text += source + " sent you " + amount + " " + noun; 
    mail.html += '<a href="'+source+'">' + source + '</a> sent you <span style="color: green">' + amount + '</span> ' + noun;
  } else if(amount < 0) {
    mail.text += source + " punished you using " + Math.abs(amount) + " " + noun; 
    mail.html += '<a href="'+source+'">' + source + '</a> punished you using <span style="color: red">' + Math.abs(amount) + '</span> ' + noun;
  } else {
    mail.text += "Private link that will let you manage your account has been generated: " + link + ".";
    mail.html += "Private link that will let you manage your account has been generated: <a href='"+link+"'>" + link + "</a>.";
  }
  if(comment) {
    mail.text += ": " + comment;
    mail.html += ": <em>" + comment + "</em>";
  } else {
    mail.text += ".";
    mail.html += ".";
  }
  mail.html += "</p>";

  if(amount != 0 && secret) {
    mail.text += "\n\nIt seems that you haven't used Points of Internet before. Use this private link to honour or punish others: " + link;
    mail.html += '<p>It seems that you haven\'t used Points of Internet before. Use this private link to honour or punish others: <a href="'+link+'">' + link + "</a>.";
  }

  mail.text += "\n\nIf you don't want to receive any more notifications, open your private link, type \"Infinity\" in the \"notification treshold\" field and save.";
  mail.html += '<p style="color: #888">If you don\'t want to receive any more notifications, open your private link, type \"Infinity\" in the "notification treshold" field and save.</p>';

  mail.text += "\n\n--\nPoints of Internet (https://pointsof.net)";
  mail.html += '<p style="color: #888"><a href="https://pointsof.net" style="color: inherit; text-decoration: none">Points of Internet</a></p>';

  transport.sendMail(mail, callback);
}

// email, secret, date
var insert_account = db.prepare("INSERT INTO accounts VALUES (?1, 0, ?3, ?2, 1.0, ?3)");
var select_last_email = db.prepare("SELECT last_email FROM accounts WHERE email = ?");
var update_secret = db.prepare("UPDATE accounts SET secret = ? WHERE email = ?");

function api_send_link(query, res) {
  if(!('email' in query)) {
    res.writeHead(400);
    res.end('Missing email');
    return;
  }
  if(!validateEmail(query.email)) {
    res.writeHead(400);
    res.end('Invalid email');
    return;
  }
  if(disposable(query.email)) {
    res.writeHead(400);
    res.end('Disposable emails disallowed');
    return;
  }

  select_last_email.get(query.email.toLowerCase(), function(err, row) {
    var secret = randomSecret();
    var digest = digestSecret(secret);
    var now = +new Date;

    if(row) {
      if(now - row.last_email < 1000 * 3600 * 24) {
        res.writeHead(400);
        res.end('Private link can be generated at most once per day');
        return;
      }
      update_secret.run(digest, query.email.toLowerCase());
    } else {
      insert_account.run(query.email.toLowerCase(), digest, now);
    }

    sendMail(query.email.toLowerCase(), '', 0, '', secret, function(error, response){
      if(error){
        res.writeHead(500);
        res.end('Couldn\'t send email: ' + error);
        return;
      }else{
        res.writeHead(200);
        res.end('Private link sent to ' + query.email.toLowerCase());
        return;
      }
    });
    
  });

}

var select_by_email = db.prepare("SELECT email, balance, date FROM accounts WHERE email = ?");
var select_by_secret = db.prepare("SELECT email, balance, date FROM accounts WHERE secret = ?");

function api_get(query, res) {
  if('email' in query) {
    if(!validateEmail(query.email)) {
      res.writeHead(400);
      res.end('Invalid email');
      return;
    }
    select_by_email.get(query.email.toLowerCase(), function(err, row) {
      res.writeHead(200);
      if(row) {
        res.end(JSON.stringify(row));
      } else {
        res.end(JSON.stringify({ email: query.email.toLowerCase(), balance: 0, date: +new Date }));
      }
    });
  } else if('secret' in query) {
    if(!validateSecret(query.secret)) {
      res.writeHead(400);
      res.end('Corrupted secret');
      return;
    }
    select_by_secret.get(digestSecret(query.secret), function(err, row) {
      if(row) {
        res.writeHead(200);
        res.end(JSON.stringify(row));
      } else {
        res.writeHead(400);
        res.end("This private link is not valid any more");
      }
    });
  } else {
    res.writeHead(400);
    res.end('Query to database was missing email or secret');
    return;
  }
}

var select_notify = db.prepare("SELECT notify FROM accounts WHERE secret = ?");
var update_notify = db.prepare("UPDATE accounts SET notify = ? WHERE secret = ?");

function api_notify(query, res) {
  if(!('secret' in query)) { 
    res.writeHead(400);
    res.end('Missing secret');
    return;
  }
  if(!validateSecret(query.secret)) {
    res.writeHead(400);
    res.end('Corrupted secret');
    return;
  }

  if('treshold' in query) {
    var treshold = Number(query.treshold);
    if(isNaN(treshold)) {
      res.writeHead(400);
      res.end('Notification treshold must be a number');
      return;
    }
    update_notify.run(query.treshold, digestSecret(query.secret));

    res.writeHead(200);
    res.end(query.treshold);
    return;
  }

  select_notify.get(digestSecret(query.secret), function(err, row) {
    if(!row) {
      res.writeHead(400);
      res.end("This private link is not valid any more");
      return;
    }
    res.writeHead(200);
    res.end("" + row.notify);
  });
}

var select_history = db.prepare("SELECT date, source, destination, amount, comment FROM history WHERE source = ?1 OR destination = ?1 ORDER BY date DESC LIMIT 10");

function api_history(query, res) {
  if(!('email' in query)) { 
    res.writeHead(400);
    res.end('Missing email');
    return;
  }
  if(!validateEmail(query.email)) {
    res.writeHead(400);
    res.end('Invalid email');
    return;
  }
  select_history.all(query.email.toLowerCase(), function(err, rows) {
    res.writeHead(200);
    res.end(JSON.stringify(rows));
  });
}

// email, balance, date
//var update_balance = db.prepare("UPDATE accounts SET balance = ?2, date = ?3 WHERE email = ?1");
var update_balance = db.prepare("UPDATE accounts SET balance = power(0.5, (?3 - date) / "+ alpha +") * balance + ?2, date = ?3 WHERE email = ?1")
// source, destination, amount, comment, date
var insert_history = db.prepare("INSERT INTO history VALUES (?, ?, ?, ?, ?)");
var select_by_email2 = db.prepare("SELECT email, balance, date, notify FROM accounts WHERE email = ?");
var last_send = {};

function api_send(query, res) {

  // Validate amount
  var amount = Number(query.amount);

  if(isNaN(amount)) {
    res.writeHead(400);
    res.end("Amount is not a number");
    return;
  }

  if(Math.abs(amount) < 0.1) {
    res.writeHead(400);
    res.end("Amount must be at least 0.1");
    return;
  }

  // Validate comment

  var comment = query.comment;
  if(comment && comment.length > 140) {
    res.writeHead(400);
    res.end("Comment can't be longer than 140 characters");
    return;
  }

  // Validate secret

  if(!('secret' in query)) {
    res.writeHead(400);
    res.end('Missing secret');
    return;
  }
  if(!validateSecret(query.secret)) {
    res.writeHead(400);
    res.end('Corrupted secret');
    return;
  }

  // Validate destination

  if(!('destination' in query)) {
    res.writeHead(400);
    res.end('Missing destination');
    return;
  }
  if(!validateEmail(query.destination)) {
    res.writeHead(400);
    res.end("Destination email invalid");
    return;
  }
  if(disposable(query.destination)) {
    res.writeHead(400);
    res.end('Disposable emails disallowed');
    return;
  }


  select_by_secret.get(digestSecret(query.secret), function(err, source_row) {

    if(!source_row) {
      res.writeHead(400);
      res.end("This private link is not valid any more");
      return;
    }
    var source = source_row.email;

    if(query.destination == source) {
      res.writeHead(400);
      res.end("Destination can't be same as source");
      return;
    }

    if((source in last_send) && (new Date - last_send[source] < 10 * 1000)) {
      res.writeHead(400);
      res.end("Please, wait a few seconds between sending");
      return;
    }

    var now = +new Date;

    if(balance(source_row, now) + credit < Math.abs(amount)) {
      res.writeHead(400);
      res.end("Not enough points");
      return;
    }

    select_by_email2.get(query.destination, function(err, dest_row) {

      var create = !dest_row;
      var secret = '';
      if(create) {
        secret = randomSecret();
        insert_account.run(query.destination, digestSecret(secret), now);
        dest_row = { email: query.destination, balance: 0, notify: 1, date: now };
      }

      last_send[source] = now;

      update_balance.run(source, - Math.abs(amount), now);
      update_balance.run(query.destination, amount, now);

      insert_history.run(source, query.destination, amount, comment, now);

      res.writeHead(200);

      source_row.balance = balance(source_row, now) - Math.abs(amount);
      source_row.date = now;
      res.end(JSON.stringify(source_row));

      if(create || (dest_row.notify <= Math.abs(amount))) {
        sendMail(query.destination, source, amount, comment, secret);
      }
      
    });
    
  });
}

http.createServer(function (req, res) {

  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;

  switch(url_parts.pathname) {
  case '/send_link':
    api_send_link(query, res);
    return;

  case '/history':
    api_history(query, res);
    return;

  case '/notify':
    api_notify(query, res);
    return;
    
  case '/get':
    api_get(query, res);
    return;

  case '/send':
    api_send(query, res);
    return;
  default:
    res.writeHead(404);
    res.end("There is no '" + url_parts.pathname + "' URL");
  }
}).listen(31913, '127.0.0.1');


