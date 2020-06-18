const Link = require('../models/link');
const User = require('../models/user');
const AWS = require('aws-sdk');
const Category = require('../models/category');
const slugify = require('slugify');
const {linkPublishedParams} = require('../helpers/email');

AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION
});

const ses = new AWS.SES({apiVersion: '2010-12-01'});


//create, list, read, update, remove
exports.create = (req,res) => {
	const {title, url, categories, type, medium} = req.body;
	//console.table({title, url, categories, type, medium});

	const slug = url;
	let link = new Link({title, url, categories, type, medium, slug});
	link.postedBy = req.user._id;

	//save link
	link.save((err, data) => {
		if(err) {
			return res.status(400).json({
				error: 'Link already exists'
			});
		}
		res.json(data);

		//find all users in the category
		User.find({categories: {$in: categories}}).exec((err, users) => {
			if(err) {
				throw new Error(err);
				console.log('Error finding users to send email on link publish');
			}
			Category.find({_id: {$in: categories}}).exec((err, result) => {
				data.categories = result;
				
				//AWS doesn't allow to send email to more than 50 recipients at a time. So we use a for loop
				for(let i = 0; i < users.length; i++) {
					const params = linkPublishedParams(users[i].email, data);

					const sendEmail = ses.sendEmail(params).promise();

					sendEmail
					.then(success => {
						console.log('Email submitted to SES', success);
						return;
					})
					.catch(failure => {
						console.log('Error on submitting email to SES', failure);
						return;
					});
				}

			})
		})
	});
};

exports.list = (req,res) => {
	let limit = req.body.limit ? parseInt(req.body.limit) : 10;
	let skip = req.body.skip ? parseInt(req.body.skip) : 0;

	Link.find({})
		.populate('postedBy', 'name')
		.populate('categories', 'name slug')
		.sort({createdAt: -1})
		.skip(skip)
		.limit(limit)
		.exec((err,data) => {
			if(err) {
				return res.status(400).json({
					error: 'Could not list any links'
				});
			}
			res.json(data);
	});
};

exports.read = (req,res) => {
	const {id} = req.params;
	Link.findOne({_id: id}).exec((err, data) => {
		if(err) {
			return res.status(400).json({
				error: 'Error finding link'
			});
		}
		res.json(data);
	});
};

exports.update = (req,res) => {
	const {id} = req.params;
	const {title, url, categories, type, medium} = req.body;
	const updatedLink = {title, url, categories, type, medium};

	Link.findOneAndUpdate({_id: id}, updatedLink, {new: true}).exec((err, updated) => {
		if(err) {
			return res.status(400).json({
				error: 'Error updating the link'
			});
		}
		res.json(updated);
	});
};

exports.remove = (req,res) => {
	const {id} = req.params;
	Link.findOneAndRemove({_id: id}).exec((err, data) => {
		if(err) {
			return res.status(400).json({
				error: 'Error deleting the link'
			});
		}
		res.json({
			message: 'Link deleted successfully'
		});
	});
};

exports.clickCount = (req, res) => {
	const {linkId} = req.body;
	Link.findByIdAndUpdate(linkId, {$inc: {clicks: 1}}, {upsert: true, new: true}).exec((err, result) => {
		if(err) {
			return res.status(400).json({
				error: 'Could not update view count'
			})
		}
		res.json(result);
	});
};


exports.popular = (req, res) => {
	Link.find()
		.populate('postedBy', 'name')
		.sort({clicks: -1})
		.limit(5)
		.exec((err, links) => {
			if(err) {
				return res.status(400).json({
					error: 'Links not found'
				});
			}
			res.json(links);
		});
};

exports.popularInCategory = (req, res) => {
	const {slug} = req.params;
	Category.findOne({slug}).exec((err, category) => {
		if(err) {
			return res.status(400).json({
				error: 'Could not load categories'
			});
		}

		Link.find({categories: category})
			.sort({clicks: -1})
			.limit(5)
			.exec((err, links) => {
				if(err) {
					return res.status(400).json({
						error: 'Links not found'
					});
				}
				res.json(links);
			});
	});
};





