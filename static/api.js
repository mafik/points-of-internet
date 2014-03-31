PI = {};
PI._iframe = document.createElement('iframe');
PI._iframe.onload = function() {
  PI.loaded = true;
  while(PI.queue.length) {
    var item = PI.queue.shift();
    PI._getBalance(item[0], item[1]);
  }
};
PI._iframe.src = "https://pointsof.net/iframe/";
PI._iframe.width = 0;
PI._iframe.height = 0;
PI._iframe.frameBorder = 0;
PI.queue = [];
PI.loaded = false;
PI.getBalance = function(email, cb) {
  if(PI.loaded) {
    PI._getBalance(email, cb);
  } else {
    PI.queue.push([email, cb]);
  }
};

PI.callbacks = {};
PI._getBalance  = function(email, cb){
  var token = "" + Math.random();
  PI.callbacks[token] = cb;
  PI._iframe.contentWindow.postMessage({ action: 'getBalance', email: email, token: token }, 'https://pointsof.net');
};

window.addEventListener("message", function(event) {
  if (event.origin !== "https://pointsof.net")
    return;
  var d = event.data;
  PI.callbacks[d.token](d.error, d.balance);
  delete PI.callbacks[d.token];
}, false);

document.body.appendChild(PI._iframe);
