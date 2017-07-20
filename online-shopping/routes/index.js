router_export = function(router, passport, User){
	router.get('/', function(req, res, next) {
		console.log('get /');
	  res.render('index', { title: 'Express' });
	});

	router.get('/login', function(req, res){
		res.render('login', {message: req.flash('loginMessage')});
	});

	router.get('/signup', 
		function(req, res){
			res.render('signup', {message: req.flash('signupMessage')});
		}
	);

	router.get('/profile', isLoggedIn, 
		function(req, res){
			res.render('profile', {
				user : req.user
			});
		}
	);

	router.post('/profile', isLoggedIn, function(req, res) {
	    console.log(req.user.local.email);
	    User.update(
	    	{email: req.user.local.email}, 
	    	{
	        	fname: req.body.fname,
	        	lname: req.body.lname 
	    	}, 
	    	function(err, numberAffected, rawResponse) {
	    		if(err){
	    			console.log(err.WriteResult.writeConcernError);
	    		}
	    		console.log(numberAffected);
	    	}
	    );
	    res.render('profile.pug', {
	        user : req.user // get the user out of session and pass to template
	    });
	});

	router.post('/signup', 
		passport.authenticate('local-signup', {
			successRedirect : '/profile',
			failureRedirect : '/signup',
			failureFlash : true
		})
	);

    router.post('/login', passport.authenticate('local-login', {
        successRedirect : '/profile', 
        failureRedirect : '/login', 
        failureFlash : true 
    }));

	router.get('/logout', function(req, res){
		req.logout();
		res.redirect('/');
	});
};

function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}

module.exports = router_export;
