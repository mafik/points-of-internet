# Points of Internet

*Points of Internet* is a reputation system intended to fight spam,
trolls & paid reviews. It is fully open-source, has public API
(without a need for registeration) and its current database can be
downloaded from [https://pointsof.net/db](https://pointsof.net/db) (for
offline hacking & data-mining).

## Client-side embedding

There are a few ways in which Points of Internet can be integrated
even with static sites:

### iframe

    <iframe frameborder=0 width=350 height=40
            src="https://pointsof.net/iframe/#[email]"></iframe>

### JavaScript

    <script src=https://pointsof.net/api.js></script>
    <script>
      PI.get_balance("[email]", function(err, balance) {
        console.log(balance);
      });
    </script>
    
### link

    <a href="https://pointsof.net/#[email]:5">
       Click here to send me 5 PI.</a>
       
## Server-side API

For an overview of server-side api, check out last lines of
`node/server.js`. All of these methods are available under prefix: `https://pointsof.net/api`.
