var mongoSanitize = require('express-mongo-sanitize');
var Item = require('../models/item');
var Category = require('../models/category');
var User = require('../models/user');
var Transaction = require('../models/transaction');
var Review = require('../models/review');
var util = require('util');
var paginate = require('express-paginate');
var multer = require('multer');
var bodyParser = require('body-parser');

var async = require('async');


//request contact and render contact form
exports.item_list = function(req, res, next) {
  req.sanitizeQuery('sort').escape();
  req.sanitizeQuery('sort').trim();

  // Sort items according to given value of sort parameter
  // Default is alphabetical
  var sort = { name: 'asc' };
  if (req.query.sort=='price-asc') { sort = { price: 'asc' } }
  else if (req.query.sort=='price-desc') { sort = { price: 'desc' } }
  else if (req.query.sort=='popular') { sort = { view_count: 'desc' } }

  // Check if a page number is given
  // If not, default is 1
  var page = req.query.page ? req.query.page : 1;
  // Limit of items per page
  var limit = 5;

  // Create an object to pass into paginate method
  var options = {
    page: page,
    limit: limit,
    sort: sort,
    populate: ['seller', 'category']
  };
  async.parallel({
    categories: function(callback) {Category.find({}).sort({ name: 'ascending' }).exec(callback);},
    cat_count: function(callback) {Item.aggregate({ '$group': { '_id': '$category', 'count': { '$sum': 1}}}).exec(callback);},
    items: function(callback){Item.paginate({},options,callback);},
  },function(err, results){
    if (err) next(err);
    var categories = JSON.parse(JSON.stringify(results.categories)); // convert mongoose into json
    for (var i = 0; i < categories.length; i++) {
      var found = false;
      for (var j = 0; j < results.cat_count.length && !found ; j++) {
        if (categories[i]._id == results.cat_count[j]._id) {
          categories[i].count = results.cat_count[j].count;
          found = true;
        }
      }
      if (!found) categories[i].count = 0;
    }
    res.render('item_list', {
      title: 'Items For Sale',
      item_list: results.items.docs,
      pageCount: results.items.pages,
      itemCount: results.items.total,
      pages: paginate.getArrayPages(req)(3, results.items.pages, page),
      page: page,
      limit: results.items.limit,
      sortBy: req.query.sort,
      catListForItemPage: categories
    });
  });
};

/*exports.item_list = function(req, res, next) {
  req.sanitizeQuery('sort').escape();
  req.sanitizeQuery('sort').trim();
  var sort = { name: 'asc' };
  if (req.query.sort=='price-asc') { sort = { price: 'asc' } }
  else if (req.query.sort=='price-desc') { sort = { price: 'desc' } }
  else if (req.query.sort=='popular') { sort = { view_count: 'desc' } }
  var page = req.query.page ? req.query.page : 1;
  var limit = 5; // Limit of items per page
  var options = {page: page,limit: limit,sort: sort,populate: ['seller', 'category']};
  Item.paginate({}, options)
  .then(function(items) {
    res.render('item_list', {title: 'Items For Sale',
      item_list: items.docs,
      pageCount: items.pages,
      itemCount: items.total,
      pages: paginate.getArrayPages(req)(3, items.pages, page),
      page: page,
      limit: items.limit,
      sortBy: req.query.sort
    });
  });
};
*/
exports.wishlist = function(req, res, next) {
  // Get wishlist from current user
  var user_id = mongoSanitize.sanitize(req.user._id);
  User.findById(user_id)
  .populate('local.wishlist')
  .exec(function(err, user) {
    if (err) { return next(err); }
      res.render('wishlist', { title: 'wishlist', wishlist: user.local.wishlist });
  });
};

exports.wishlist_add = function(req, res, next) {
  req.filter('id').escape();
  req.filter('id').trim();

  var item_slug = mongoSanitize.sanitize(req.params.id);

  Item.findOne({'slug' : item_slug})
  .exec(function(err, item) {
    if (err) { return next(err); }
    if(!item) {
        req.flash('error', 'Item does not exist.');
        res.redirect('/items');
        return;
    }
    var conditions = { _id : req.user._id };
    var update = { $addToSet : { 'local.wishlist' : item }};

    User.update(conditions, update)
    .exec(function(err, user) {
        if(err) { return next(err); }
        req.flash('success', item.name + ' added to your Wish List');
        res.redirect('/wishlist');
    });
  });
};

exports.wishlist_delete = function(req, res, next) {
  req.filter('id').escape();
  req.filter('id').trim();

  var item_slug = mongoSanitize.sanitize(req.params.id);

  Item.findOne({'slug':item_slug})
  .exec(function(err, item) {
    if (err) { return next(err); }
    var user_id = mongoSanitize.sanitize(req.user._id);
    var conditions = { _id : user_id };
    var update = { $pull : { 'local.wishlist' : item._id }};

    User.update(conditions, update)
    .exec(function(err, user) {
        if(err) { return next(err); }
        req.flash('success', item.name + ' removed From Wishlist');
        res.redirect('/wishlist');
    });
  });
};

exports.item_search = function(req, res, next) {
  req.sanitizeQuery('sort').escape();
  req.sanitizeQuery('sort').trim();
  req.sanitizeQuery('keyword').escape();
  req.sanitizeQuery('keyword').trim();
  var keyword = req.query.keyword;

  // Default is relevant
  var sort;
  if (req.query.sort=='price-asc') { sort = { price: 'asc' } }
  else if (req.query.sort=='price-desc') { sort = { price: 'desc' } }
  else if (req.query.sort=='popular') { sort = { view_count: 'desc' } }

  var page = req.query.page ? req.query.page : 1;
  var limit = 5;

  var query = {
    'name' :  { $regex: keyword, $options: 'i' }
  };

  var options = {
    page: page,
    limit: limit,
    sort: sort,
    populate: ['seller', 'category']
  };

  Item.paginate(query, options)
  .then(function(items) {
    res.render('item_search', {
      title: 'Search results: ' + keyword,
      keyword: keyword, // this keyword is from search field, passed to view to be used when user changes sort by option
      item_list: items.docs,
      pageCount: items.pages,
      itemCount: items.total,
      pages: paginate.getArrayPages(req)(3, items.pages, page),
      page: page, // page number
      limit: items.limit,
      sortBy: req.query.sort // could be null
    });
  });
}

exports.item_detail = function(req, res, next) {
  mongoSanitize.sanitize(req.params);
  req.filter('id').escape();
  req.filter('id').trim();
  Item.findOne({'slug' : req.params.id})
  .populate('seller').populate('category')
  .exec(function (err, item) {
    if (err) { return next(err); }
    if (req.user != null && item.seller.local.email == req.user.local.email){user = 'seller';}
    else{user = 'buyer';}
    if(!item){
        res.redirect('/items');
        return;
    }
    // Increment view count and save
    item.view_count++;
    item.save(function(err, updatedItem) {
        if (err) { return next(err); }
        Review.find({item: item._id})
        .populate('reviewer')
        .exec(function (err, list_reviews){
            if (err){return next(err);}
            res.render('item_detail', { title: updatedItem.name, item: updatedItem, user : user, review_list: list_reviews});
        });
    });
  });
}

exports.item_create_get = function(req, res) {
  Category.find({}, 'name')
  .sort({ name: 'ascending' })
  .exec(function(err, categories) {
    if (err) { next(err); }
    res.render('item_form', { title: 'New item', category_list: categories });
  });
};

exports.item_create_post = function(req, res, next) {
  console.log(req.body);
  mongoSanitize.sanitize(req.body);
  req.checkBody('name', 'Item name must be specified').notEmpty();
  req.checkBody('price', 'Price must be specified').notEmpty();
  req.checkBody('price', 'Price: only floating-point number is allowed').isFloat();
  req.checkBody('category', 'Category must be specified').notEmpty();
  req.checkBody('lat', 'Latitude must be specified').notEmpty();
  req.checkBody('lat', 'Latitude: only floating-point number is allowed').isFloat();
  req.checkBody('lng', 'Longitude must be specified').notEmpty();
  req.checkBody('lng', 'Longitude: only floating-point number is allowed').isFloat();


  req.filter('name').escape();
  req.filter('name').trim();
  req.filter('price').escape();
  req.filter('price').trim();
  req.filter('category').escape();
  req.filter('category').trim();
  req.filter('description').escape();
  req.filter('description').trim();
  req.filter('lat').escape();
  req.filter('lat').trim();
  req.filter('lng').escape();
  req.filter('lng').trim();

  //res.send(req.files);
  //var path = req.files[0].path;
  mongoSanitize.sanitize(req.files[0]);
  mongoSanitize.sanitize(req.files[1]);
  mongoSanitize.sanitize(req.files[2]);
  mongoSanitize.sanitize(req.body);
  var imageNumber = 0;
  var imageName0;
  //assume user upload image according to the order
  if (req.files[0]){
    imageName0 = req.files[0].originalname;
    imageNumber++;
  }
  if (req.files[1]){
    imageName0 = req.files[1].originalname;
    imageNumber++;
  }
  if (req.files[2]){
    imageName0 = req.files[2].originalname;
    imageNumber++;
  }
  if (!req.files[0] && !req.files[1] && !req.files[2]){
      imageName0 = 'question-mark.svg';
  }

  /*var imagepath = {}; //imagepath contains two objects, path and the imageName
  imagepath['path'] = path;
  imagepath['originalname'] = imageName;*/
  User.findOne({'local.email': req.user.local.email}, function(err, user){
    if(err){
      throw err;
    }
    if(!user){
      console.log('Invalid email received: ' + req.user.local.email);
      next(err);
    }
    var item = new Item({
      name: req.body.name,
      price: req.body.price,
      category: req.body.category,
      description: req.body.description,
      lat: req.body.lat,
      lng: req.body.lng,
      image : imageName0,
      /*for(i=0; i< image_total_upload.length; i++){
        image_total.push(image_total_upload[i]);
      }*/
      //image_total : image_total_upload,
      seller: user._id
    });
    // add price to price history
    item.price_history.push({ price: req.body.price, date: new Date() });
    //for(var i=0; i< image_total_upload.length; i++){
    //  item.image_total.push(image_total_upload[i]);}
    for(var i=0; i<imageNumber; i++){
      item.image_total.push({ image: req.files[i].originalname });
      console.log(item.image_total);
    }

    req.getValidationResult().then(function(result) {
      var errors = result.array();
      if (errors.length > 0) {
        Category.find({}, 'name')
        .exec(function(err, categories) {
          if (err) { return next(err); }
          // add errors to flash
          for (var i = 0; i < errors.length; i++) {
            req.flash('error', errors[i].msg);
          }
          res.locals.error_messages = req.flash('error');
          res.render('item_form', { title: 'Create New Item', item: item, category_list: categories, selected_category: item.category, errors: errors })
        });
      } else {
        item.save(function(err) {
          if (err) {
            throw err;
            next(err);
          }
          res.redirect(item.url);
        });
      }
    });
  });
};

exports.item_update_get = function(req, res, next) {
  req.filter('id').escape();
  req.filter('id').trim();

  async.parallel({
    item: function(callback) {
      mongoSanitize.sanitize(req.params.id);
      Item.findOne({'slug': req.params.id})
          .populate('seller')
          .exec(callback);
    },
    category: function(callback) {
      Category.find({}, 'name').sort({ name: 'ascending'}).exec(callback);
    }
  }, function(err, results) {
    if (err) {
      next(err);
    }
    if(!results.item){
        res.redirect('/items');
        return;
    }
    if(results.item.seller.local.email == req.user.local.email) {
        res.render('item_form', { title: 'Update Item', category_list: results.category, item: results.item, selected_category: results.item.category });
    }
    else {
        req.flash('error', 'You can only edit your own items');
        res.redirect('/items');
    }
  });
}

exports.item_update_post = function(req, res, next) {
  req.filter('id').escape();
  req.filter('id').trim();

  req.body = mongoSanitize.sanitize(req.body);
  req.checkBody('name', 'Item name must be specified').notEmpty();
  req.checkBody('price', 'Price must be specified').notEmpty();
  req.checkBody('price', 'Price: only floating-point number is allowed').isFloat();
  req.checkBody('category', 'Category must be specified').notEmpty();
  req.checkBody('lat', 'Latitude must be specified').notEmpty();
  req.checkBody('lat', 'Latitude: only floating-point number is allowed').isFloat();
  req.checkBody('lng', 'Longitude must be specified').notEmpty();
  req.checkBody('lng', 'Longitude: only floating-point number is allowed').isFloat();

  req.filter('name').escape();
  req.filter('name').trim();
  req.filter('price').escape();
  req.filter('price').trim();
  req.filter('category').escape();
  req.filter('category').trim();
  req.filter('description').escape();
  req.filter('description').trim();
  req.filter('lat').escape();
  req.filter('lat').trim();
  req.filter('lng').escape();
  req.filter('lng').trim();

  mongoSanitize.sanitize(req.params);
  var item_slug = req.params.id;
  Item.findOne({'slug': item_slug})
  .populate('seller')
  .exec(function(err, item) {
    if (err) { return next(err); }

    // If user is not item owner, redirect them to /items
    if (item.seller.local.email != req.user.local.email) {
      req.flash('error', 'You can only edit your own items');
      res.redirect('/items');
    } else {

      // Form validation
      req.getValidationResult().then(function(result) {
        var errors = result.array();
        // If there's any error, render the form with errors
        if (errors.length > 0) {

          Category.find({}, 'name')
          .exec(function(err, categories) {
            if (err) {
              return next(err);
            }
            // add errors to flash
            for (var i = 0; i < errors.length; i++) {
              req.flash('error', errors[i].msg);
            }
            res.locals.error_messages = req.flash('error');

            res.render('item_form', { title: 'Update New Item', item: item, category_list: categories, selected_category: item.category, errors: errors });
          });

        } else {
          item.name = req.body.name;
          item.price = req.body.price;
          item.category = req.body.category;
          item.description = req.body.description;
          item.lat = req.body.lat;
          item.lng = req.body.lng;
          item.price_history.push({ price: req.body.price, date: new Date() });

          //in update page, if user still upload new files:
          var imageNumber=0;
          var imageName0;
          if (req.files[0]){
            imageName0 = mongoSanitize.sanitize(req.files[0].originalname);
            imageNumber++;}
          if (req.files[1]){
            imageName0 = mongoSanitize.sanitize(req.files[1].originalname);
            imageNumber++;}
          if (req.files[2]){
            imageName0 = mongoSanitize.sanitize(req.files[2].originalname);
            imageNumber++;}
          if (!req.files[0] && !req.files[1] && !req.files[2]){
              imageName0 = 'question-mark.svg';}

          if (imageNumber + item.image_total.length <= 3)
            for(var i=0; i<imageNumber; i++){
              item.image_total.push({ image: req.files[i].originalname });
              //console.log(item.image_total);
            }
          else{
            for (var i=0; i<imageNumber; i++){
              //console.log(item.image_total);
              //item.image_total[i].pop;
              item.image_total.splice(i,1); //pop
              //console.log(item.image_total);
              item.image_total.push({ image: req.files[i].originalname});
            }
          }

          item.save(function(err) {
            if (err) { return next(err); }
            res.redirect(item.url);
          });
        }
      });
    }
  });
}

exports.item_delete = function(req, res, next) {
  mongoSanitize.sanitize(req.body);
  req.filter('id').escape();
  req.filter('id').trim();
  // validating item creator
  Item.findById(req.body.itemid)
  .populate('seller')
  .exec(function(err, item) {
      if (err) {
          return next(err);
      }
      if (item.seller.local.email != req.user.local.email) {
          req.flash('error', 'You can only delete your own items');
          res.redirect('/items');
      } else {
          Item.findByIdAndRemove(req.body.itemid, function deleteItem(err) {
              if (err) { return next(err); }
              res.redirect('/items');
          })
      }
  });
}

exports.item_buy_get = function(req, res, next) {
  mongoSanitize.sanitize(req.params);
  req.filter('id').escape();
  req.filter('id').trim();

  Item.findOne({'slug': req.params.id})
  .populate('seller')
  .exec(function (err, item) {
    if (err) { return next(err); }
    if(item.seller.local.email == req.user.local.email){
        req.flash('error', 'You cannot buy your own items');
        res.redirect('/items');
    } else{
        res.render('item_buy', { title: 'Check out', item: item });
    }

  });
}

// exports.item_maps = function(req, res, next){
//   mongoSanitize.sanitize(req.params);
//   req.filter('id').escape();
//   req.filter('id').trim();
//
//   Item.findOne(req.params.id)
//   .populate('seller')
//   .exec(function (err, item) {
//     if (err) { return next(err); }
//     res.render('index', { item: item });
//     console.log(user);
//   });
//
// }

exports.item_buy_post = function(req, res, next) {
    mongoSanitize.sanitize(req.body);
    req.checkBody('quantity', 'quantity must be specified').notEmpty();
    req.checkBody('quantity', 'quantity: only integer number is allowed').isInt();
    req.checkBody('ship_address', 'Shipping address must be specified').notEmpty();
    req.checkBody('credit_card_number', 'Credit card number: only integer number is allowed').isInt();
    req.checkBody('cvv', 'CVV must be specified').notEmpty();
    req.checkBody('cvv', 'CVV : only integer number is allowed').isInt();
    req.checkBody('expiry_date', 'expiry date: only date format is allowed').notEmpty().isDate();

    req.filter('quantity').escape();
    req.filter('quantity').trim();
    req.filter('ship_address').escape();
    req.filter('ship_address').trim();
    req.filter('credit_card_number').escape();
    req.filter('credit_card_number').trim();
    req.filter('cvv').escape();
    req.filter('cvv').trim();
    req.filter('expiry_date').escape();
    req.filter('expiry_date').trim();

    Item.findById(req.body.itemid)
    .populate('seller')
    .exec(function (err, item) {
        if (err) {
            return next(err);
        }
        User.findOne({'local.email': req.user.local.email}, function(err, user) {
            if (err) {
                throw err;
            }
            if (!user) {
                console.log('Invalid email received: ' + req.user.local.email);
                next(err);
            }
            if (req.body.credit_card_number.length != 16) {
                req.flash('error', 'Credit card number must be 16 digit number.');
                res.locals.error_messages = req.flash('error');
                res.render('item_buy', { title: 'Check out', item: item, quantity: req.body.quantity, ship_address: req.body.ship_address,credit_card_number: req.body.credit_card_number,  cvv: req.body.cvv, expiry_date: req.body.expiry_date});
                return;
            }
            if (req.body.cvv.length != 3) {
                req.flash('error', 'CVV number must be 3 digit number.');
                res.locals.error_messages = req.flash('error');
                res.render('item_buy', { title: 'Check out', item: item, quantity: req.body.quantity, ship_address: req.body.ship_address,credit_card_number: req.body.credit_card_number,  cvv: req.body.cvv, expiry_date: req.body.expiry_date});
                return;
            }
            else{
                var currentDate = new Date();
                var transaction = new Transaction({
                    buyer: user._id,
                    item: req.body.itemid,
                    quantity: req.body.quantity,
                    ship_address: req.body.ship_address,
                    credit_card_number: req.body.credit_card_number,
                    cvv: req.body.cvv,
                    expiry_date: req.body.expiry_date,
                    purchase_date: currentDate
                });
                if (item.seller.local.email == req.user.local.email) {
                    req.flash('error', 'You cannot buy your own items');
                    res.redirect('/items');
                }
                else {
                    req.getValidationResult().then(function (result) {
                        var errors = result.array();
                        if (errors.length > 0) {
                            res.status(400).send('There have been validation errors: ' + util.inspect(result.array()));
                            return;
                        } else {
                            transaction.save(function (err) {
                                if (err) {
                                    throw err;
                                    next(err);
                                }
                                else {
                                    res.render('transaction_result', {title: 'Successful'});
                                }
                            });
                        }
                    });
                }
            }
        });
    });
}

  exports.item_review_post = function(req, res, next) {
    mongoSanitize.sanitize(req.body);
    mongoSanitize.sanitize(req.user.local.email);
    req.checkBody('item', 'Item name must be specified').notEmpty();
    req.checkBody('rating', 'rating must be specified').notEmpty().isInt();


    req.filter('item').escape();
    req.filter('item').trim();
    req.filter('review').escape();
    req.filter('review').trim();
    req.filter('rating').escape();
    req.filter('rating').trim();

    User.findOne({'local.email': req.user.local.email}, function(err, user){
      if(err){
        throw err;
      }
      if(!user){
        console.log('Invalid email received: ' + req.user.local.email);
        next(err);
      }
      var item_slug = req.params.id;
      Item.findOne({'slug': item_slug})
      .populate('seller')
      .exec(function (err, item) {
        if (err) { return next(err); }
        if (req.user != null && item.seller.local.email == req.user.local.email){
          res.redirect(item.url);
          return;
        }
        var currentDate = new Date();

        if(!item) {
            req.flash('error', 'Item does not exists.');
            res.redirect('/items');
            return;
        }

        var review = new Review({
          item: item._id,
          reviewer: user._id,
          review: req.body.review,
          rating: req.body.rate_field,
          review_date: currentDate
        });
        console.log(req.body.rate_field);
        review = review.toObject();
        delete review["_id"];

        Review.findOneAndUpdate({'item': item._id, 'reviewer': user._id}, review,
          {upsert:true}, function(err, review){
            if(err){
              console.log(err);
              res.redirect(item.url);
            }
            else {
              // Find all reviews of current item and calculate average rating
              Review.aggregate([
                { '$match': { 'item': item._id }},
                { '$group': { _id: '$item',
                  average: { '$avg' : '$rating'},
                  count: { '$sum' : 1 }}}
              ])
              .exec( function(err, reviewInfo){
                if (err) {
                  next(err);
                } else {
                  // round rating so it can only be 1, 1.5, 2, ... , 4.5, 5.0
                  item.rating = Math.round(reviewInfo[0].average * 2) / 2;
                  item.review_count =  reviewInfo[0].count;

                  Item.findByIdAndUpdate(item._id, item, {})
                  .exec(function(err, updatedItem) {
                    if (err) {
                      next(err);
                    } else {
                      res.redirect(updatedItem.url);
                    }
                  });
                }
              });
            }
        });
    });
  });
}
