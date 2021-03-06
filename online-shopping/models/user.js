var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');
var moment = require('moment');
var authTypes = ['github', 'twitter', 'facebook', 'google'];

var Schema = mongoose.Schema;

var userSchema = mongoose.Schema({
    local : {
        email           : {type: String, required: true },
        fname           : {type: String, required: true, max: 100},
        lname           : {type: String, required: true, max: 100},
        password     	  : {type: String, required: true },
        date_of_birth   : {type: Date},
        address			    : {type: String},
        cell_phone 		  : {type: String},
        gender          : {type: String, enum: ['Male', 'Female']},
        wishlist        : [{type: Schema.ObjectId, ref: 'Item'}]
    }
});

userSchema
.virtual('dateFormat')
.get(function() {
  return this.local.date_of_birth ? moment(this.local.date_of_birth).utcOffset(0).format('YYYY-MM-DD') : '';
});

userSchema.statics.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// generating a hash
userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
