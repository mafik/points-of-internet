
function validateEmail(email) { 
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

var email = document.getElementById('email');
var points = document.getElementById('points');
var plus = document.getElementById('plus');
var minus = document.getElementById('minus');

var targetState = { balance: 0, date: +new Date };
var halfTime = 1000 * 3600 * 24 * 50;

function currentBalanceFromState(state) {
  return Math.pow(0.5, (+new Date - state.date) / halfTime) * state.balance;
}

function fillPoints() {
  points.textContent = currentBalanceFromState(targetState).toFixed(2);
}

setInterval(fillPoints, 200);

function showError(desc) {
  console.error(desc);
  var top = document.getElementById('top');
  top.textContent = desc;
  top.classList.add('error');
  plus.classList.add('hide');
  minus.classList.add('hide');
  top.onclick = function() { location.reload() };
}

var target = location.hash.substr(1).toLowerCase();
if(validateEmail(target)) {
  email.textContent = target;
  getState(target, function(err, state) {
    if(err) {
      showError(err);
      return;
    }
    targetState = state;
    fillPoints();
  });
}

plus.addEventListener('click', function() {
  sendOrder(1);
});

minus.addEventListener('click', function() {
  sendOrder(-1);
});

function getState(email, cb) {
  var request = new XMLHttpRequest();
  request.open('GET', '/api/get?email=' + email.toLowerCase(), true);
  request.onload = function() {
    if (this.status >= 200 && this.status < 400) {
      cb(undefined, JSON.parse(this.response));
    } else {
      cb(this.status == 502 ? "Couldn't connect to database" : this.response);
    }
  };
  request.onerror = function() {
    cb(this);
  };
  request.send();
}


function getBalance(email, cb) {
  getState(email, function(error, state) {
    if(error) {
      cb(error, undefined);
    } else {
      cb(undefined, currentBalanceFromState(state));
    }
  });
}

function sendOrder(amount) {
  if(!localStorage.secret) {
    window.parent.location.href = 'https://pointsof.net';
    return;
  }
  var request = new XMLHttpRequest();
  var url = '/api/send?secret=' + localStorage.secret + "&amount=" + amount + "&destination=" + target + "&comment=" + encodeURIComponent("Widget click");
  request.open('GET', url, true);

  request.onload = function() {
    if (this.status >= 200 && this.status < 400){
      targetState.balance = currentBalanceFromState(targetState) + amount;
      targetState.date = +new Date;
    } else {
      showError(this.status == 502 ? "Couldn't connect to database" : this.response);
    }
  };

  request.onerror = function() {
    showError(this);
  };

  request.send();
};

// Make links open in parent window

function openInParent() {
  window.parent.location = this.href;
  return false;
}

function doload () {
  var links = document.getElementsByTagName ('a');
  for(i in links) {
    links[i].onclick = openInParent;
  }
}

window.onload = doload;

window.addEventListener('message',function(e) {
  var d = e.data;
  if(d.action === 'getBalance') {
    if(!validateEmail('' + d.email)) {
      e.source.postMessage({ token: d.token, error: "Invalid email", balance: NaN }, e.origin);
      return;
    }
    getBalance('' + d.email, function(err, balance) {
      e.source.postMessage({ token: d.token, error: err, balance: balance }, e.origin);
    });
  }
}, false);
