var express = require('express');
var mysql = require('mysql');

var connection = mysql.createConnection({
    host:'us-cdbr-iron-east-05.cleardb.net',
    user:'********',
    password:'********',
    database:'heroku_11d18415b26e7a3'
});

var app = express();
var handlebars = require('express-handlebars').create({defaultLayout:'main'});
var session = require('express-session');
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({secret:'SuperSecretPassword'}));

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

var port = process.env.PORT || 3000
app.set('port', port);

app.use(express.static('public'));

//For use when neededing to update GameScores for Skaters
app.get('/update-gamescores-skaters', function(req, res) {
    res.render('update');

    connection.query('SELECT a.GameDate, oi.GameDate, a.Player, a.TOI, a.Goals, a.First_Assists, a.Second_Assists, a.Shots, a.Shots_Blocked, oi.CF, oi.CA, oi.GF, oi.GA, a.Pen_Drawn, a.Total_Penalties, a.Faceoffs_Won, a.Faceoffs_Lost, a.GameScore FROM gs_allsit_ind_1718po as a' +
        ' LEFT JOIN gs_5v5_oi_1718po as oi ON (a.Player = oi.Player and a.GameDate = oi.GameDate)',
        function(error, results, fields) {

            if (error) {
                console.log(error);
            }
            //Else statement will start to assign players and build the objects needed
            else {
                var players = results;
            }

            //Start GameScore extraction, calculation and reinsertion
            players.forEach(function(element) {

                let CALC_GS = (0.0)
                CALC_GS= calculateSkaterGS(element)

                connection.query('UPDATE gs_allsit_ind_1718po a SET  a.GameScore= ? WHERE a.GameDate = ? AND a.Player = ?', 
                    [CALC_GS, element.GameDate, element.Player]);
            });
        });

    console.log("Update Complete.")

});

app.get('/update-gamescores-goalies', function(req, res) {
    connection.query('SELECT GameDate, Player, goals, (shots - goals) as saves, g_GameScore from allsit_goalies_1718po',
        function(error, results, fields) {

            var goalies = results;

            goalies.forEach(function(element) {
                var date = element.GameDate;

                let g_CALC_GS = 0.0;
                g_CALC_GS = calculateGoalieGS(element);

                connection.query('UPDATE allsit_goalies_1718po a SET  g_GameScore= ? WHERE GameDate = ? AND Player = ?', [g_CALC_GS, date, element.Player]);

            });
        });

    console.log("Update Complete.")

});

//Need to grab the teams available on that day and send them to the GS page as well.
app.get('/gsrequest', function(req,res){
    connection.query("SELECT GameDate, home_team, vis_team, gamenum FROM heroku_11d18415b26e7a3.game_info_1718po;",function (error,results,fields) {
       var context= {};
       var games = results;

       games.forEach(function(element){
            element.gameDate = formatDate(element);
       });

       //Assign the proper games to the context object
       context.games = games;
       console.log("Card Request Completed.");
       res.render('gsform', context)
    });
});

app.post('/gamescore-all', function(req, res) {
    var context = {};
    var passedGameNum = req.body.date;


    connection.query('SELECT * from game_info_1718po WHERE gamenum= ?', [passedGameNum], function(error, results, fields) {
        var querydata = results[0];

        //Date Information
        var date = formatDate(querydata);

        //Start Score information
        var displayScore = querydata.vis_score + "\t" + "-" + "\t" + querydata.home_score;

        context.header = "GameScore Card";
        context.score = displayScore;
        context.date = date

        //TeamInformation
        context.h_team = querydata.home_team;
        context.v_team = querydata.vis_team;

        //Get Abbreviations for Queries
        teamDict = {}
        names = ["Anaheim Ducks", "Arizona Coyotes", "Boston Bruins", "Buffalo Sabres",
            "Calgary Flames", "Carolina Hurricanes", "Chicago Blackhawks",
            "Colorado Avalanche", "Columbus Blue Jackets", "Dallas Stars",
            "Detroit Red Wings", "Edmonton Oilers", "Florida Panthers",
            "Los Angeles Kings", "Minnesota Wild", "Montreal Canadiens",
            "Nashville Predators", "New Jersey Devils", "New York Islanders",
            "New York Rangers", "Ottawa Senators", "Philadelphia Flyers",
            "Pittsburgh Penguins", "San Jose Sharks", "St Louis Blues",
            "Tampa Bay Lightning", "Toronto Maple Leafs", "Vancouver Canucks",
            "Vegas Golden Knights", "Washington Capitals", "Winnipeg Jets"
        ]
        abv = ["ANA", "ARI", "BOS", "BUF", "CGY", "CAR", "CHI", "COL",
            "CBJ", "DAL", "DET", "EDM", "FLA", "LA", "MIN", "MTL",
            "NSH", "NJ", "NYI", "NYR", "OTT", "PHI", "PIT", "SJ",
            "STL", "TB", "TOR", "VAN", "VGK", "WSH", "WPG"
        ]

        for (var a = 0; a < names.length; a++) {
            teamDict[names[a]] = abv[a];
        }

        //Get the abreviation from the dictionary
        var homeAbrev = teamDict[context.home_team]
        var visAbrev = teamDict[context.vis_team]


        connection.query('SELECT src from images WHERE team_name = ?', [context.v_team], function(error, results, fields) {
            var data = results[0];
            context.visitingTeamImgSrc = data.src;
        });

        connection.query('SELECT src from images WHERE team_name = ?', [context.h_team], function(error, results, fields) {
            var data = results[0];
            context.homeTeamImgSrc = data.src;
        });


        //This works but need to select and join
        connection.query('SELECT a.Player, a.TOI, a.Goals, a.First_Assists, a.Second_Assists, a.Shots, a.Shots_Blocked, oi.CF, oi.CA, ' +
            'oi.GF, oi.GA, a.Pen_Drawn, a.Total_Penalties, a.Faceoffs_Won, a.Faceoffs_Lost, a.GameScore FROM gs_allsit_ind_1718po a INNER JOIN ' +
            'gs_5v5_oi_1718po oi ON a.Player = oi.Player WHERE a.GameDate = ? AND oi.GameDate = ?', [querydata.GameDate, querydata.GameDate],
            function(error, results, fields) {
                if (error) {
                    console.log(error);
                }
                //Else statement will start to assign players and build the objects needed
                else {
                    var players = results;

                    //Start GameScore extraction, calculation and reinsertion
                    players.forEach(function(element) {
                        if (element.GameScore == null) {
                          let CALC_GS = (0.0);
                        CALC_GS = calculateSkaterGS(element)

                        connection.query('UPDATE gs_allsit_ind_1718po a SET  a.GameScore= ? WHERE a.GameDate = ? AND a.Player = ?', [CALC_GS, querydata.GameDate, element.Player]);
   
                        }
                       
                    });

                    connection.query('SELECT a.Player, FORMAT(a.TOI,2) as TOI , a.Goals, a.Total_Assists, a.Shots, a.Shots_Blocked, (oi.CF - oi.CA) as CD, ' +
                        '(oi.GF - oi.GA) as GD, (a.Pen_Drawn - a.Total_Penalties) as PD, (a.Faceoffs_Won - a.Faceoffs_Lost) as FD, FORMAT(a.GameScore,2) as GameScore' +
                        ', a.team FROM gs_allsit_ind_1718po a INNER JOIN ' +
                        'gs_5v5_oi_1718po oi ON a.Player = oi.Player WHERE a.GameDate = ? AND oi.GameDate = ? Order by GameScore DESC LIMIT 15', [querydata.GameDate, querydata.GameDate],
                        function(error, results, fields) {
                            context.playerData = results;

                            //Get, Send Back - Goalie Stats
                            connection.query('SELECT Player, goals, (shots - goals) as saves, g_GameScore from allsit_goalies_1718po WHERE allsit_goalies_1718po.GameDate = ?', [querydata.GameDate], function(error, results, fields) {

                                var goalies = results;

                                goalies.forEach(function(element) {
                                    if (element.g_GameScore == null) {
                                    let g_CALC_GS = 0.0;
                                    g_CALC_GS = calculateGoalieGS(element);

                                    connection.query('UPDATE allsit_goalies_1718po a SET  g_GameScore= ? WHERE GameDate = ? AND Player = ?', [g_CALC_GS, querydata.GameDate, element.Player]);
                                    }

                                });

                                connection.query('SELECT abrev, src FROM images', function(error, results, fields) {
                                    if (error) {
                                        console.log(error);
                                    } else {
                                        var images = results;
                                        var imageDict = {};

                                        images.forEach(function(element) {
                                            imageDict[element.abrev] = element.src;
                                        });

                                        context.playerData.forEach(function(e) {
                                            e.team = imageDict[e.team];
                                        });

                                        res.render('nhl', context);
                                    }


                                });


                            });


                        });


                }
            });


    });

});

app.post('/gamescore-all-filtered', function(req, res) {
    var context = {};
    var passedGameNum = req.body.date;


    connection.query('SELECT * from game_info_1718po WHERE gamenum= ?', [passedGameNum], function(error, results, fields) {
        var querydata = results[0];
        console.log(querydata);

        //Date Information
        var date = formatDate(querydata);

        //Start Score information
        var displayScore = querydata.vis_score + "\t" + "-" + "\t" + querydata.home_score;

        context.header = "GameScore Card";
        context.score = displayScore;
        context.date = date;

        //TeamInformation
        context.h_team = querydata.home_team;
        context.v_team = querydata.vis_team;

        //Get Abbreviations for Queries
        teamDict = {}
        names = ["Anaheim Ducks", "Arizona Coyotes", "Boston Bruins", "Buffalo Sabres",
            "Calgary Flames", "Carolina Hurricanes", "Chicago Blackhawks",
            "Colorado Avalanche", "Columbus Blue Jackets", "Dallas Stars",
            "Detroit Red Wings", "Edmonton Oilers", "Florida Panthers",
            "Los Angeles Kings", "Minnesota Wild", "Montreal Canadiens",
            "Nashville Predators", "New Jersey Devils", "New York Islanders",
            "New York Rangers", "Ottawa Senators", "Philadelphia Flyers",
            "Pittsburgh Penguins", "San Jose Sharks", "St Louis Blues",
            "Tampa Bay Lightning", "Toronto Maple Leafs", "Vancouver Canucks",
            "Vegas Golden Knights", "Washington Capitals", "Winnipeg Jets"
        ]
        abv = ["ANA", "ARI", "BOS", "BUF", "CGY", "CAR", "CHI", "COL",
            "CBJ", "DAL", "DET", "EDM", "FLA", "LA", "MIN", "MTL",
            "NSH", "NJ", "NYI", "NYR", "OTT", "PHI", "PIT", "SJ",
            "STL", "TB", "TOR", "VAN", "VGK", "WSH", "WPG"
        ]

        for (var a = 0; a < names.length; a++) {
            teamDict[names[a]] = abv[a];
        }

        //Get the abreviation from the dictionary
        var homeAbrev = teamDict[context.h_team]
        var visAbrev = teamDict[context.v_team]


        connection.query('SELECT src from images WHERE team_name = ?', [context.v_team], function(error, results, fields) {
            var data = results[0];
            context.visitingTeamImgSrc = data.src;
        });

        connection.query('SELECT src from images WHERE team_name = ?', [context.h_team], function(error, results, fields) {
            var data = results[0];
            context.homeTeamImgSrc = data.src;
        });

        connection.query('SELECT a.Player, a.TOI, a.Goals, a.First_Assists, a.Second_Assists, a.Shots, a.Shots_Blocked, oi.CF, oi.CA, ' +
            'oi.GF, oi.GA, a.Pen_Drawn, a.Total_Penalties, a.Faceoffs_Won, a.Faceoffs_Lost, a.GameScore FROM gs_allsit_ind_1718po a INNER JOIN ' +
            'gs_5v5_oi_1718po oi ON a.Player = oi.Player WHERE a.GameDate = ? AND oi.GameDate = ? and (a.team= ? or a.team= ?)', [querydata.GameDate, querydata.GameDate, homeAbrev, visAbrev],
            function(error, results, fields) {
                if (error) {
                    console.log(error);
                }
                //Else statement will start to assign players and build the objects needed
                else {

                    var players = results;

                    //Start GameScore extraction, calculation and reinsertion
                    players.forEach(function(element) {
                        if (element.GameScore == null) {
                        let CALC_GS = (0.0);
                        //Player Game Score = (0.75 * G) + (0.7 * A1) + (0.55 * A2) + (0.075 * SOG) + (0.05 * BLK) + (0.15 * PD) – (0.15 * PT) +
                        // (0.01 * FOW) – (0.01 * FOL) + (0.05 * CF) – (0.05 * CA) + (0.15 * GF) – (0.15* GA)
                        CALC_GS = calculateSkaterGS(element);

                        connection.query('UPDATE gs_allsit_ind_1718po a SET  a.GameScore= ? WHERE a.GameDate = ? AND a.Player = ?', [CALC_GS, querydata.GameDate, element.Player]);
                        }

                    });

                    connection.query('SELECT a.Player, FORMAT(a.TOI,2) as TOI , a.Goals, a.Total_Assists, a.Shots, a.Shots_Blocked, (oi.CF - oi.CA) as CD, ' +
                        '(oi.GF - oi.GA) as GD, (a.Pen_Drawn - a.Total_Penalties) as PD, (a.Faceoffs_Won - a.Faceoffs_Lost) as FD, FORMAT(a.GameScore,2) as GameScore' +
                        ', a.team FROM gs_allsit_ind_1718po a INNER JOIN ' +
                        'gs_5v5_oi_1718po oi ON a.Player = oi.Player WHERE a.GameDate = ? AND oi.GameDate = ? and (a.team=? or a.team=?)', [querydata.GameDate, querydata.GameDate, homeAbrev, visAbrev],
                        function(error, results, fields) {
                            context.playerData = results;

                            //Get, Send Back - Goalie Stats
                            connection.query('SELECT Player, goals, (shots - goals) as saves, g_GameScore from allsit_goalies_1718po WHERE allsit_goalies_1718po.GameDate = ? and (team=? or team=?)', [querydata.GameDate, homeAbrev, visAbrev], function(error, results, fields) {

                                var goalies = results;

                                goalies.forEach(function(element) {
                                    if (element.g_GameScore == null) {
                                    let g_CALC_GS = 0.0;
                                    g_CALC_GS = calculateGoalieGS(element);

                                    connection.query('UPDATE allsit_goalies_1718po a SET  g_GameScore= ? WHERE GameDate = ? AND Player = ?', [g_CALC_GS, querydata.GameDate, element.Player]);
                                    }
                                });

                                connection.query('SELECT Player, shots, goals, FORMAT(g_GameScore,2) as g_GameScore, team from allsit_goalies_1718po WHERE GameDate = ? and (team= ? or team= ?)', [querydata.GameDate, homeAbrev, visAbrev], function(error, results, fields) {

                                    var goalies = results;

                                    context.goalieData = goalies;

                                    connection.query('SELECT abrev, src FROM images', function(error, results, fields) {
                                        if (error) {
                                            console.log(error);
                                        } else {
                                            var images = results;
                                            var imageDict = {};

                                            images.forEach(function(element) {
                                                imageDict[element.abrev] = element.src;
                                            });

                                            context.playerData.forEach(function(e) {
                                                e.team = imageDict[e.team];
                                            });

                                            context.goalieData.forEach(function(e) {
                                                e.team = imageDict[e.team];
                                            });

                                            res.render('ducks', context);
                                        }


                                    });


                                });


                            });


                        });


                }
            });


    });

});

app.get('/gamescore', function (req, res) {
    var context = {};


    //Get Gamedate
    connection.query('SELECT max(GameDate) as recentGame from game_info_1718po', function (error, results) {
        var data = results[0];
        var gameDate = data.recentGame;
        context.SQLgameDate = gameDate;

        console.log(gameDate);


        connection.query('SELECT * from game_info_1718po WHERE GameDate= ?', [context.SQLgameDate], function (error, results, fields) {
            var querydata = results[0];
            console.log(querydata);

            //Date Information
            var date = querydata.GameDate;
            date = JSON.stringify(context.SQLgameDate);
            console.log("Pass from above: ", date);
            date = date.split("T");
            date = date[0];
            date = date.substr(1);
            date = date.split("-");
            date = date[1] + "-" + date[2] + "-" + date[0];
            displayDate = date;
            console.log(displayDate);
            //End Date Information

            //Start Score information
            var displayScore = querydata.vis_score + "\t" + "-" + "\t" + querydata.home_score;

            context.header = "Anaheim Ducks GameScore Card";
            context.score = displayScore;
            context.date = displayDate;

            //TeamInformation
            context.h_team = querydata.home_team;
            context.v_team = querydata.vis_team;

            connection.query('SELECT src from images WHERE team_name = ?', [context.v_team], function (error, results, fields) {
                var data = results[0];
                context.visitingTeamImgSrc = data.src;
            });

            connection.query('SELECT src from images WHERE team_name = ?', [context.h_team], function (error, results, fields) {
                var data = results[0];
                context.homeTeamImgSrc = data.src;
            });


            //This works but need to select and join
            connection.query('SELECT a.Player, a.TOI, a.Goals, a.First_Assists, a.Second_Assists, a.Shots, a.Shots_Blocked, oi.CF, oi.CA, ' +
                'oi.GF, oi.GA, a.Pen_Drawn, a.Total_Penalties, a.Faceoffs_Won, a.Faceoffs_Lost, a.GameScore FROM gs_allsit_ind_1718po a INNER JOIN ' +
                'gs_5v5_oi_1718po oi ON a.Player = oi.Player WHERE a.GameDate = ? AND oi.GameDate = ?',
                [context.SQLgameDate, context.SQLgameDate], function (error, results, fields) {
                    if (error) {
                        console.log(error);
                    }
                    //Else statement will start to assign players and build the objects needed
                    else {
                        console.log(results);
                        var players = results;
                        
                        //Start GameScore extraction, calculation and reinsertion
                        players.forEach(function (element) {
                            let CALC_GS = (0.0);
                            //Player Game Score = (0.75 * G) + (0.7 * A1) + (0.55 * A2) + (0.075 * SOG) + (0.05 * BLK) + (0.15 * PD) – (0.15 * PT) +
                            // (0.01 * FOW) – (0.01 * FOL) + (0.05 * CF) – (0.05 * CA) + (0.15 * GF) – (0.15* GA)

                            CALC_GS = calculateSkaterGS(element)
                            
                            connection.query('UPDATE gs_allsit_ind_1718po a SET  a.GameScore= ? WHERE a.GameDate = ? AND a.Player = ?',
                                [CALC_GS, context.SQLgameDate, element.Player]);


                        });

                        connection.query('SELECT a.Player, FORMAT(a.TOI,2) as TOI , a.Goals, a.Total_Assists, a.Shots, a.Shots_Blocked, (oi.CF - oi.CA) as CD, ' +
                            '(oi.GF - oi.GA) as GD, (a.Pen_Drawn - a.Total_Penalties) as PD, (a.Faceoffs_Won - a.Faceoffs_Lost) as FD, FORMAT(a.GameScore,2) as GameScore' +
                            ' FROM gs_allsit_ind_1718po a INNER JOIN ' +
                            'gs_5v5_oi_1718po oi ON a.Player = oi.Player WHERE a.GameDate = ? AND oi.GameDate = ?',
                            [context.SQLgameDate, context.SQLgameDate], function (error, results, fields) {
                                context.playerData = results;
                                console.log(context.playerData);

                                //Get, Send Back - Goalie Stats
                                connection.query('SELECT Player, goals, (shots - goals) as saves, g_GameScore from allsit_goalies_1718po WHERE allsit_goalies_1718po.GameDate = ?',
                                    [context.SQLgameDate], function (error, results, fields) {

                                        var goalies = results;
                                        var g_CALC_GS = 0.0;

                                        goalies.forEach(function (element) {

                                            console.log(element.Player);

                                            g_CALC_GS += (element.saves * .1);
                                            g_CALC_GS -= (element.goals * .75);

                                            console.log(g_CALC_GS);

                                            console.log("update!");
                                            connection.query('UPDATE allsit_goalies_1718po a SET  g_GameScore= ? WHERE GameDate = ? AND Player = ?',
                                                [g_CALC_GS, context.SQLgameDate, element.Player]);


                                        });

                                        connection.query('SELECT Player, shots, goals, FORMAT(g_GameScore,2) as g_GameScore from allsit_goalies_1718po WHERE GameDate = ?',
                                            [context.SQLgameDate], function (error, results, fields) {

                                                var goalies = results;
                                                console.log(goalies);

                                                context.goalieData = goalies;
                                                console.log(context);


                                                res.render('ducks', context);
                                            });


                                    });


                            });


                    }
                });


        });


    });


});

app.get('/cardrequest', function(req,res){
    connection.query("SELECT distinct(Player) FROM heroku_11d18415b26e7a3.gs_allsit_ind;",function (error,results,fields) {
       var context= {};

       var players = results;
       context.players = players;

       res.render('cardform', context)
    });
});

app.post('/card', function(req,res){
    var context = {};

    var name = req.body.name;
    console.log(name);

    connection.query("SELECT allsit.Player, FORMAT(avg(allsit.toi),2) as TOI, sum(allsit.Goals) as Goals, sum(allsit.Total_Assists) as Assists, " +
        "sum(allsit.Shots) as Shots, sum(allsit.Shots_Blocked) as Blocks, (sum(onice.CF) - sum(onice.CA)) as CD, (sum(allsit.Pen_Drawn) - sum(allsit.Total_Penalties)) as PD, " +
        "(sum(allsit.Faceoffs_Won) - sum(allsit.Faceoffs_Lost)) as FD, FORMAT(avg(allsit.GameScore),2) as GameScore FROM heroku_11d18415b26e7a3.gs_allsit_ind allsit INNER JOIN " +
        "heroku_11d18415b26e7a3.gs_5v5_oi onice ON allsit.GameDate = onice.GameDate AND " +
        "allsit.Player = onice.Player WHERE allsit.Player = ? group by allsit.Player;", [name], function(error, results, fields) {

        if (error) {
            console.log(error)
        }
        else {
            console.log(results);
            context.player=results[0];

            connection.query("SELECT distinct(Player), gs_allsit_ind.Position FROM heroku_11d18415b26e7a3.gs_allsit_ind where gs_allsit_ind.Player = ?",
                 [name], function(error, results, fields) {
                    if (error) {
                        console.log(error)
                    }
                    else {
                        var position = results[0].Position;
                        var symbol = "!=";

                        if (position === "D") {
                            symbol = "="
                        }

                        var query = "select format((table1.toi),2) as TeamTOI, format(avg(table1.goals),0) as TeamGoals, format(avg(table1.assists),0) as TeamAssists, " +
                            "format(avg(table1.shots),0) as TeamShots, format(avg(table1.blocks),0) as TeamBlocks, format(avg(table1.CD),0) as TeamCD, format(avg(table1.PD),0) as TeamPD, " +
                            "format(avg(table1.FD),0) as TeamFD, format(avg(table1.GameScore),2) as TeamGameScore FROM (SELECT allsit.Player, allsit.Position, FORMAT(avg(allsit.toi),2) as TOI, sum(allsit.Goals) as goals, sum(allsit.Total_Assists) as assists, " +
                            "sum(allsit.Shots) as shots, sum(allsit.Shots_Blocked) as blocks, (sum(onice.CF) - sum(onice.CA)) as CD, (sum(allsit.Pen_Drawn) - sum(allsit.Total_Penalties)) as PD, " +
                            "(sum(allsit.Faceoffs_Won) - sum(allsit.Faceoffs_Lost)) as FD, FORMAT(avg(allsit.GameScore),2) as GameScore FROM heroku_11d18415b26e7a3.gs_allsit_ind allsit INNER JOIN " +
                            "heroku_11d18415b26e7a3.gs_5v5_oi onice ON allsit.GameDate = onice.GameDate AND " +
                            "allsit.Player = onice.Player where allsit.Position " + symbol + " \"D\" group by allsit.Player having sum(allsit.toi) > 100) as table1";

                        connection.query(query, function(error, results,fields) {
                           context.teamNums = results[0];
                           console.log(context);
                            res.render('card', context);
                        });
                    }
            });
        }
    });

});

app.post('/get-chart-data', function(req,res) {
    var name = req.body.name;

    connection.query("SELECT a.GameDate, (oi.CF-oi.CA) as CD, a.GameScore FROM gs_allsit_ind a INNER JOIN " +
        "gs_5v5_oi oi ON a.GameDate = oi.GameDate AND a.Player = oi.Player WHERE a.GameDate BETWEEN DATE_SUB(NOW(), INTERVAL 30 DAY) AND NOW() AND a.Player = ?;",
        [name], function (error, results, fields) {

            if(error){
                console.log(error);
            }
            else {
                res.send(results)
            }
        });

});
app.get('/leaderboard',function(req, res){
    res.render('leaderboard');
});
app.use(function(req,res){
  res.status(404);
  res.render('404');
});

app.use(function(err, req, res, next){
  console.error(err.stack);
  res.type('plain/text');
  res.status(500);
  res.render('500');
});

app.listen(app.get('port'), function(){
  console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});

//Function Definitions 
function calculateSkaterGS(element) {

    let CALC_GS = (0.0);
    //Player Game Score = (0.75 * G) + (0.7 * A1) + (0.55 * A2) + (0.075 * SOG) + (0.05 * BLK) + (0.15 * PD) – (0.15 * PT) +
    // (0.01 * FOW) – (0.01 * FOL) + (0.05 * CF) – (0.05 * CA) + (0.15 * GF) – (0.15* GA)

    CALC_GS = (element.Goals * .75);

    CALC_GS += (element.First_Assists * .7);

    CALC_GS += (element.Second_Assists * .55);

    CALC_GS += (element.Shots * .075);

    CALC_GS += (element.Shots_Blocked * .05);

    CALC_GS += (element.Pen_Drawn * .15);

    CALC_GS -= (element.Total_Penalties * .15);

    CALC_GS += (element.Faceoffs_Won * .01);

    CALC_GS -= (element.Faceoffs_Lost * .01);

    CALC_GS += (element.CF * .05);

    CALC_GS -= (element.CA * .05);

    CALC_GS += (element.GF * .15);

    CALC_GS -= (element.GA * .15);

    CALC_GS = CALC_GS.toFixed(2);

    return CALC_GS
}

function calculateGoalieGS(element) {
    let CALC_GS = (0.0);

    CALC_GS += (element.saves * .1);
    CALC_GS -= (element.goals * .75);

    return CALC_GS;

}

function formatDate(element) {

    let date = JSON.stringify(element.GameDate);

    date = date.split("T");
    date = date[0];
    date = date.substr(1);
    date = date.split("-");
    date = date[1] + "-" + date[2] + "-" + date[0];

    return date

}