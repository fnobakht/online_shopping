var Category = require('../models/category');
var Item = require('../models/item');

var async = require('async');

exports.category_list = function(req, res, next) {
  Category.find({}, 'name')
  .sort({ name: 'ascending' })
  .exec(function (err, list_categories) {
    if (err) { return next(err); }
    res.render('category_list', { title: 'Categories', category_list: list_categories });
  });
};

exports.category_detail = function(req, res, next) {
  req.filter('id').escape();
  req.filter('id').trim();

  async.parallel({
    items: function(callback) {
      Item.find({ category: req.params.id }, 'name seller').exec(callback);
    },
    category: function(callback) {
      Category.findById(req.params.id).exec(callback);
    }
  }, function(err, results) {
    if (err) { next(err); }
    res.render('category_detail', { title: results.category.name + ' Category', item_list: results.items, category: results.category })
  });
}

exports.category_create_get = function(req, res, next) {
  res.render('category_form', { title: 'Create New Category' });
};

exports.category_create_post = function(req, res, next) {
  req.checkBody('name', 'Category name must be specified').notEmpty();

  req.filter('name').escape();
  req.filter('name').trim();

  var category = new Category({
    name: req.body.name,
  });

  req.getValidationResult().then(function(result) {
    var errors = result.array();
    if (errors.length > 0) {
      res.render('category_form', { title: 'Create New Category', category: category, errors: errors });
    } else {
      category.save(function(err) {
        if (err) { next(err); }
        res.redirect('/categories');
      });
    }
  });
};

exports.category_update_get = function(req, res, next) {
  req.filter('id').escape();
  req.filter('id').trim();

  Category.findById(req.params.id)
  .exec(function(err, category) {
    if (err) { next(err); }
    res.render('category_form', { title: 'Update Category: ' + category.name, category: category });
  });
}

exports.category_update_post = function(req, res, next) {
  req.filter('id').escape();
  req.filter('id').trim();

  req.checkBody('name', 'Category name must be specified').notEmpty();

  req.filter('name').escape();
  req.filter('name').trim();

  var category = new Category({
    name: req.body.name,
    _id: req.params.id
  });

  req.getValidationResult().then(function(result) {
    var errors = result.array();
    if (errors.length > 0) {
      res.render('category_form', { title: 'Update Category: ' + category.name, category: category, errors: errors });
    } else {
      Category.findByIdAndUpdate(req.params.id, category, {}, function(err, thecategory) {
        if (err) { return next(err); }
        res.redirect(thecategory.url);
      });
    }
  });

}
