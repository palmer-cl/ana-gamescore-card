var express = require('express');
var mysql = require('mysql');

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'qsio_db'
});


var app = express();
var handlebars = require('express-handlebars').create({defaultLayout: 'main'});
var session = require('express-session');
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({extended: false}));
app.use(session({secret: 'SuperSecretPassword'}));

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', 3000);
app.use(express.static('public'));

app.get('/update-test', function (req, res) {
    connection.query('SELECT a.GameDate, a.Player, a.TOI, a.Goals, a.First_Assists, a.Second_Assists, a.Shots, a.Shots_Blocked, oi.CF, oi.CA, ' +
        'oi.GF, oi.GA, a.Pen_Drawn, a.Total_Penalties, a.Faceoffs_Won, a.Faceoffs_Lost, a.GameScore FROM gs_allsit_ind a INNER JOIN ' +
        'gs_5v5_oi oi ON a.Player = oi.Player LIMIT 50', function (error, results, fields) {

        var players = results;
        players.forEach(function (element) {
            if (element.GameScore === null) {
                console.log(element.GameScore);
            }
        });

    });
});

app.get('/update-gamescores-skaters', function (req, res) {
    res.render('update');

    connection.query('SELECT a.GameDate, oi.GameDate, a.Player, a.TOI, a.Goals, a.First_Assists, a.Second_Assists, a.Shots, a.Shots_Blocked, oi.CF, oi.CA, oi.GF, oi.GA, a.Pen_Drawn, a.Total_Penalties, a.Faceoffs_Won, a.Faceoffs_Lost, a.GameScore FROM gs_allsit_ind as a' +
        ' LEFT JOIN gs_5v5_oi as oi ON (a.Player = oi.Player and a.GameDate = oi.GameDate)', function (error, results, fields) {

        if (error) {
            console.log(error);
        }
        //Else statement will start to assign players and build the objects needed
        else {
            var players = results;
            var CALC_GS = (0.0);
        }

        //Start GameScore extraction, calculation and reinsertion
        players.forEach(function (element) {

            CALC_GS = (0.0);
            //Player Game Score = (0.75 * G) + (0.7 * A1) + (0.55 * A2) + (0.075 * SOG) + (0.05 * BLK) + (0.15 * PD) – (0.15 * PT) +
            // (0.01 * FOW) – (0.01 * FOL) + (0.05 * CF) – (0.05 * CA) + (0.15 * GF) – (0.15* GA)

            console.log(element.Player, "on", element.GameDate, ": GameScore is ", element.GameScore);

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


            connection.query('UPDATE gs_allsit_ind a SET  a.GameScore= ? WHERE a.GameDate = ? AND a.Player = ?',
                [CALC_GS, element.GameDate, element.Player]
            );

            console.log(element.Player, "on", element.GameDate, ": GameScore AFTER UPDATE is ", element.GameScore);
        });
    });


});


app.get('/gamescore', function (req, res) {
    var context = {};


    //Get Gamedate
    connection.query('SELECT max(GameDate) as recentGame from game_info', function (error, results) {
        var data = results[0];
        var gameDate = data.recentGame;
        context.SQLgameDate = gameDate;

        console.log(gameDate);


        connection.query('SELECT * from game_info WHERE GameDate= ?', [context.SQLgameDate], function (error, results, fields) {
            var querydata = results[0];
            console.log(querydata);

            //Date Information
            var date = querydata.GameDate;
            date = JSON.stringify(context.SQLgameDate);
            date = date.split("T");
            date = date[0];
            date = date.substr(1);
            date = date.split("-");
            date = date[1] + "-" + date[2] + "-" + date[0];
            displayDate = date;
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
                'oi.GF, oi.GA, a.Pen_Drawn, a.Total_Penalties, a.Faceoffs_Won, a.Faceoffs_Lost, a.GameScore FROM gs_allsit_ind a INNER JOIN ' +
                'gs_5v5_oi oi ON a.Player = oi.Player WHERE a.GameDate = ? AND oi.GameDate = ?',
                [context.SQLgameDate, context.SQLgameDate], function (error, results, fields) {
                    if (error) {
                        console.log(error);
                    }
                    //Else statement will start to assign players and build the objects needed
                    else {
                        console.log(results);
                        var players = results;
                        var CALC_GS = (0.0);

                        //Start GameScore extraction, calculation and reinsertion
                        players.forEach(function (element) {
                            CALC_GS = (0.0);
                            //Player Game Score = (0.75 * G) + (0.7 * A1) + (0.55 * A2) + (0.075 * SOG) + (0.05 * BLK) + (0.15 * PD) – (0.15 * PT) +
                            // (0.01 * FOW) – (0.01 * FOL) + (0.05 * CF) – (0.05 * CA) + (0.15 * GF) – (0.15* GA)

                            CALC_GS = (element.Goals * .75);
                            console.log(element.Goals);

                            CALC_GS += (element.First_Assists * .7);
                            console.log(element.First_Assists);

                            CALC_GS += (element.Second_Assists * .55);
                            console.log(element.Second_Assists);

                            CALC_GS += (element.Shots * .075);
                            console.log(element.Shots);

                            CALC_GS += (element.Shots_Blocked * .05);
                            console.log(element.Shots_Blocked);

                            CALC_GS += (element.Pen_Drawn * .15);
                            console.log(element.Pen_Drawn);

                            CALC_GS -= (element.Total_Penalties * .15);
                            console.log(element.Total_Penalties);

                            CALC_GS += (element.Faceoffs_Won * .01);
                            console.log(element.Faceoffs_Won);

                            CALC_GS -= (element.Faceoffs_Lost * .01);
                            console.log(element.Faceoffs_Lost);

                            CALC_GS += (element.CF * .05);
                            console.log(element.CF);

                            CALC_GS -= (element.CA * .05);
                            console.log(element.CA);

                            CALC_GS += (element.GF * .15);
                            console.log(element.GF);

                            CALC_GS -= (element.GA * .15);
                            console.log(element.GA);

                            CALC_GS = CALC_GS.toFixed(2);
                            console.log(CALC_GS);


                            connection.query('UPDATE gs_allsit_ind a SET  a.GameScore= ? WHERE a.GameDate = ? AND a.Player = ?',
                                [CALC_GS, context.SQLgameDate, element.Player]);


                        });

                        connection.query('SELECT a.Player, FORMAT(a.TOI,2) as TOI , a.Goals, a.Total_Assists, a.Shots, a.Shots_Blocked, (oi.CF - oi.CA) as CD, ' +
                            '(oi.GF - oi.GA) as GD, (a.Pen_Drawn - a.Total_Penalties) as PD, (a.Faceoffs_Won - a.Faceoffs_Lost) as FD, FORMAT(a.GameScore,2) as GameScore' +
                            ' FROM gs_allsit_ind a INNER JOIN ' +
                            'gs_5v5_oi oi ON a.Player = oi.Player WHERE a.GameDate = ? AND oi.GameDate = ?',
                            [context.SQLgameDate, context.SQLgameDate], function (error, results, fields) {
                                context.playerData = results;
                                console.log(context.playerData);

                                //Get, Send Back - Goalie Stats
                                connection.query('SELECT Player, goals, (shots - goals) as saves, g_GameScore from allsit_goalies WHERE allsit_goalies.GameDate = ?',
                                    [context.SQLgameDate], function (error, results, fields) {

                                        var goalies = results;
                                        var g_CALC_GS = 0.0;

                                        goalies.forEach(function (element) {

                                            g_CALC_GS += (element.saves * .1);
                                            g_CALC_GS -= (element.goals * .75);

                                            connection.query('UPDATE allsit_goalies a SET  g_GameScore= ? WHERE GameDate = ? AND Player = ?',
                                                [g_CALC_GS, context.SQLgameDate, element.Player]);


                                        });

                                        connection.query('SELECT Player, shots, goals, FORMAT(g_GameScore,2) as g_GameScore from allsit_goalies WHERE GameDate = ?',
                                            [context.SQLgameDate], function (error, results, fields) {

                                                var goalies = results;
                                                console.log(goalies);

                                                context.goalieData = goalies;


                                                res.render('ducks', context);
                                            });


                                    });


                            });


                    }
                });


        });


    });


});

app.use(function (req, res) {
    res.status(404);
    res.render('404');
});

app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.type('plain/text');
    res.status(500);
    res.render('500');
});

app.listen(app.get('port'), function () {
    console.log('Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.');
});


