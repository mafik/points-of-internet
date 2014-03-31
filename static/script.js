
function validateSecret(secret) { 
  var re = /^[a-zA-Z0-9]{20}$/;
  return re.test(secret);
} 

function validateEmail(email) { 
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
} 


// Join form


var join_input = document.getElementById('join_email');
var join_button = document.getElementById('join_send');
var join_error = document.getElementById('join_error');
var join_success = document.getElementById('join_success');

join_button.addEventListener('click', function() {

  join_error.parentElement.classList.add('hide');
  join_success.classList.add('hide');

  if(!validateEmail(join_input.value)) {
    join_error.textContent = "wrong email address";
    join_error.parentElement.classList.remove('hide');
    return;
  }

  var request = new XMLHttpRequest();
  request.open('GET', '/api/send_link?email=' + join_input.value.toLowerCase(), true);

  request.onload = function() {
    if (this.status >= 200 && this.status < 400){
      join_success.textContent = this.response;
      join_success.classList.remove('hide');
    } else {
      var response;
      if(this.status == 404) response = "Couldn't connect to database";
      else response = this.response.trim();
      join_error.textContent = response;
      join_error.parentElement.classList.remove('hide');
    }
  };

  request.onerror = function() {
    join_error.textContent = "connection couldn't have been established";
    join_error.parentElement.classList.remove('hide');
  };

  request.send();

});


// Google wallet form


document.getElementById('support_google').addEventListener('click', function() {
  google.payments.inapp.buy({
    parameters: {},
    jwt: "eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiIxMjM1MTYyODI2ODgxM" + 
      "zI3NjAyNiIsImF1ZCI6Ikdvb2dsZSIsInR5cCI6Imdvb2dsZS9" + 
      "wYXltZW50cy9pbmFwcC9pdGVtL3YxIiwiaWF0IjoxMzk1OTI0N" + 
      "jM5LCJleHAiOjE1NTAwMDAwMDAsInJlcXVlc3QiOnsiY3VycmV" + 
      "uY3lDb2RlIjoiVVNEIiwicHJpY2UiOiI5LjAwIiwibmFtZSI6I" + 
      "lJpc3Bla3QgZG9uYXRpb24iLCJkZXNjcmlwdGlvbiI6IkdpZnQ" + 
      "gdG8gc3VwcG9ydCBvbmdvaW5nIGRldmVsb3BtZW50IG9mIFJpc" + 
      "3Bla3QifX0.Fkp6UW9hqGlf28jBigb1xoh97d2bro8BPEKnr3D" + 
      "7BSE",
    success: function() { },
    failure: function() { }
  })
});

//////////////////////////////////
// Manage section
//////////////////////////////////

if(validateSecret(location.hash.substr(1))) {
  localStorage.secret = location.hash.substr(1);
}

if(localStorage.secret) {
  document.getElementById('explanation').classList.add('hide');
  document.getElementById('join_form').classList.add('hide');
  document.getElementById('manage_form').classList.remove('hide');
  initialize();
}

var log_out = document.getElementById('log_out');
log_out.addEventListener('click', function() {
  localStorage.clear();
  document.getElementById('explanation').classList.remove('hide');
  document.getElementById('join_form').classList.remove('hide');
  document.getElementById('manage_form').classList.add('hide');
  setEmail('[email]');
  location.href = '/';
});

var emailSpans = document.querySelectorAll('.email');

function setEmail(email) {
  for(var i = 0; i < emailSpans.length; ++i) {
    emailSpans[i].textContent = email.toLowerCase();
  }
}

function getEmail() {
  return emailSpans[0].textContent;
}

var integer = document.getElementById('integer');
var fract = document.getElementById('fract');
var historyBody = document.getElementById('history');
var ping = +new Date;

var balance;
var date;
var halfTime = 1000 * 3600 * 24 * 50;

function handleState(response) {
  var pong = +new Date;
  var state = JSON.parse(response);
  
  setEmail(state.email);
  date = state.date + (pong - ping) / 2;
  balance = state.balance;

  localStorage.email = state.email;
  localStorage.date = date;
  localStorage.balance = state.balance;

  var historyRequest = new XMLHttpRequest();
  historyRequest.open('GET', '/api/history?email=' + state.email, true);

  historyRequest.onload = function() {
    if (this.status >= 200 && this.status < 400){
      var tbody = document.createElement('tbody');

      JSON.parse(this.response).forEach(function(event, i) {
        var row = tbody.insertRow(0);
        row.insertCell(0).textContent = event.comment;
        row.insertCell(0).textContent = event.amount;
        row.insertCell(0).textContent = event.destination;
        row.insertCell(0).textContent = event.source;
        row.insertCell(0).textContent = moment(event.date).calendar();
      });

      historyBody.parentElement.replaceChild(tbody, historyBody);
      historyBody = tbody;
    } else {
      var response = this.response;
      if(this.status == 404) response = "Couldn't connect to database";
      connection_error.querySelector('span').textContent = response;
      connection_error.classList.remove('hide');
    }
  };

  historyRequest.onerror = function() {
    connection_error.querySelector('span').textContent = this;
    connection_error.classList.remove('hide');
  };

  historyRequest.send();
  
}

function fillPoints() {
  var realBalance = Math.pow(0.5, (+new Date - date) / halfTime) * balance;
  var places = 2;
  if(Math.abs(realBalance) > 1000) {
    places = 3;
  } else if(Math.abs(realBalance) > 100) {
    places = 4;
  } else if(Math.abs(realBalance) > 10) {
    places = 5;
  } else if(Math.abs(realBalance) > 1) {
    places = 6;
  } else {
    places = 6;
  }
  var str = realBalance.toFixed(places).split('.');
  if(integer.textContent != str[0]) {
    integer.textContent = str[0];
  }
  if(fract.textContent != str[1]) {
    fract.textContent = str[1];
  }
}

function initialize() {

  var request = new XMLHttpRequest();
  request.open('GET', '/api/get?secret=' + localStorage.secret, true);

  request.onload = function() {
    if (this.status >= 200 && this.status < 400){
      handleState(this.response);
      fillPoints();
      setInterval(fillPoints, 50);
    } else {
      var response = this.response;
      if(this.status == 404) response = "Couldn't connect to database";
      connection_error.querySelector('span').textContent = response;
      connection_error.classList.remove('hide');
    }
  };

  request.onerror = function() {
    connection_error.querySelector('span').textContent = this;
    connection_error.classList.remove('hide');
  };

  request.send();


  var treshold = document.getElementById('treshold');
  var save_treshold = document.getElementById('save_treshold');

  var notifyRequest = new XMLHttpRequest();
  notifyRequest.open('GET', '/api/notify?secret=' + localStorage.secret, true);

  notifyRequest.onload = function() {
    if (this.status >= 200 && this.status < 400){
      treshold.value = this.response;
      save_treshold.classList.add('inactive');
    } else {
      var response = this.response;
      if(this.status == 404) response = "Couldn't connect to database";
      connection_error.querySelector('span').textContent = response;
      connection_error.classList.remove('hide');
    }
  };

  notifyRequest.onerror = function() {
    connection_error.querySelector('span').textContent = this;
    connection_error.classList.remove('hide');
  };

  notifyRequest.send();
}

treshold.addEventListener('input', function() {
  save_treshold.classList.remove('inactive');
  treshold_nan.classList.add('hide');
  if(isNaN(Number(treshold.value)) || treshold.value.length < 1) {
    treshold_nan.classList.remove('hide');
  }
});

save_treshold.addEventListener('click', function() {
  if(save_treshold.classList.contains('inactive')) return;

  if(isNaN(Number(treshold.value))) {
    return;
  }

  var notifyRequest = new XMLHttpRequest();
  notifyRequest.open('GET', '/api/notify?secret=' + localStorage.secret + '&treshold=' + treshold.value, true);

  notifyRequest.onload = function() {
    if (this.status >= 200 && this.status < 400){
      treshold.value = this.response;
      save_treshold.classList.add('inactive');
    } else {
      console.log(this.response);
      // TODO: show error
    }
  };

  notifyRequest.onerror = function() {
    // TODO: show error
  };

  notifyRequest.send();

  
});

var destination = document.getElementById('destination');
var amount = document.getElementById('amount');

var arr = location.hash.substr(1).split(':');

if(validateEmail(arr[0])) {
  destination.value = arr[0];
}

if(Number.isFinite(Number(arr[1]))) {
  amount.value = Number(arr[1]);
}

var destination_invalid = document.getElementById('destination_invalid');
var destination_equal = document.getElementById('destination_equal');
var amount_nan = document.getElementById('amount_nan');
var amount_small = document.getElementById('amount_small');
var server_error = document.getElementById('server_error');
var connection_error = document.getElementById('connection_error');
var treshold_nan = document.getElementById('treshold_nan');
var comment_long = document.getElementById('comment_long');

function validateForm() {
  destination_invalid.classList.add('hide');
  destination_equal.classList.add('hide');
  amount_nan.classList.add('hide');
  amount_small.classList.add('hide');
  server_error.classList.add('hide');
  comment_long.classList.add('hide');
  var ans = true;

  if(!validateEmail(destination.value)) {
    destination_invalid.classList.remove('hide');
    ans = false;
  }
  if(destination.value.toLowerCase() == getEmail()) {
    destination_equal.classList.remove('hide');
    ans = false;
  }
  if(isNaN(Number(amount.value))) {
    amount_nan.classList.remove('hide');
    ans = false;
  } else if(Math.abs(Number(amount.value)) < 0.1) {
    amount_small.classList.remove('hide');
    ans = false;
  }
  if(comment.value.length > 140) {
    comment_long.classList.remove('hide');
    ans = false;
  }
  return ans;
}

document.getElementById('send').addEventListener('click', function() {
  sendOrder(1);
});

document.getElementById('punish').addEventListener('click', function() {
  sendOrder(-1);
});

function sendOrder(direction) {
  if(!validateForm()) return;

  var request = new XMLHttpRequest();
  var url = '/api/send?secret=' + localStorage.secret + "&amount=" + direction * amount.value + "&destination=" + destination.value.toLowerCase();
  if(comment.value) {
    url += "&comment=" + encodeURIComponent(comment.value);
  }
  request.open('GET', url, true);

  request.onload = function() {
    if (this.status >= 200 && this.status < 400){
      handleState(this.response);
      fillPoints();
    } else {
      server_error.classList.remove('hide');
      server_error.innerHTML = "There was an error: " + this.response + ".<br>If it's my fault, let me know: <a href=\"mailto:bugs@pointsof.net\">bugs@pointsof.net</a>";
    }
  };

  request.onerror = function() {
    console.log(this);
    server_error.classList.remove('hide');
    server_error.textContent = "There was an error connection error";
  };

  ping = +new Date();
  request.send();
};
