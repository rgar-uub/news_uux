var needle = require('needle');
var cheerio = require('cheerio');
var tress = require('tress');
var resolve = require('url').resolve;
var sqlite3 = require('sqlite3').verbose();

var startURL = 'https://www.buzzbuzzhome.com/city/united-states/maryland/baltimore';
var results = [];
var q = tress(work);
q.drain = done;
start();

function start(){
    needle.get(startURL, function(err, res){
        if (err) throw err;
        var $ = cheerio.load(res.body);
        $('.city-dev-name>a').each(function(){
            q.push(resolve(startURL, $(this).attr('href')));
        });
    });
}

function work(url, cb){
    needle.get(url, function(err, res){
        if (err) throw err;
        var $ = cheerio.load(res.body);
        results.push([
            url,
            $('h1').text().trim(),
            $('.price-info').eq(0).text().replace(/\s+/g, ' ').trim()
        ]);
        cb();
    });
}

function done(){
    var db = new sqlite3.Database('data.sqlite');
    db.serialize(function(){
        db.run('DROP TABLE IF EXISTS new');
        db.run('CREATE TABLE new (url TEXT, name TEXT, price TEXT)');
        var stmt = db.prepare('INSERT INTO new VALUES (?, ?, ?)');
        for (var i = 0; i < results.length; i++) {
            stmt.run(results[i]);
        };
        stmt.finalize();
        db.run('CREATE TABLE IF NOT EXISTS data (url TEXT, name TEXT, price TEXT, state TEXT)');
        db.run('UPDATE data set state = NULL');
        db.run('INSERT INTO data SELECT url, name, price, "new" AS state FROM new ' +
            'WHERE url IN (SELECT url FROM new EXCEPT SELECT url FROM data)');
        db.run('DELETE FROM data WHERE url IN (SELECT url FROM data EXCEPT SELECT url FROM new)');
        db.run('UPDATE data SET state = "upd", price = (SELECT price FROM new WHERE new.url = data.url) ' +
            'WHERE url IN (SELECT old.url FROM data AS old, new WHERE old.url = new.url AND old.price <> new.price)');
        db.run('DROP TABLE new');
        db.close();
    });
}
