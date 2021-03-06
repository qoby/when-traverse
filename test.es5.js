'use strict';

var whenTraverse = require('./'),
	Promise = require('bluebird'),
	util = require('util');

Promise.prototype.inspect = function()  {return 'Promise'};

// delayed promise helper (for tests only)
var delayed = function(timeout, value)  {return new Promise(function(resolve ) {return setTimeout(function()  {return resolve(value)}, timeout)})};

// test wrapped providing test object, sample tree and time difference function
var whenTraverseTest = function(callback ) {return function(test ) {
	var tree = {
		a: 0,
		b: delayed(100, {
			b1: delayed(200, 2),
			b2: delayed(300, 3)
		}),
		c: delayed(400, 4),
		d: {
			shouldNotGoHere: delayed(500, 5)
		}
	};

	var startTime = Date.now();
	var timeDiff = function()  {return Date.now() - startTime};

	callback(test, tree, timeDiff).then(function()  {return test.done()}, function(err ) { throw err });
}};

exports['enter+leave'] = whenTraverseTest(function(test, tree, getElapsed) 
	{return whenTraverse(tree, {
		enter: function(node, key, parentNode)  {
			var elapsed = getElapsed();

			console.log('Entered %s (key: %s) after %d ms', util.inspect(node), key, elapsed);

			// check timings

			var shouldElapse;

			if (typeof node === 'number') {
				shouldElapse = node * 100;
			} else
			if (node === tree || node === tree.d) {
				shouldElapse = 0;
			} else
			if ('b1' in node) {
				shouldElapse = 100;
			}

			test.equal(Math.round(elapsed / 100) * 100, shouldElapse);

			if (typeof node === 'object' && 'shouldNotGoHere' in node) {
				return whenTraverse.SKIP;
			}
		},
		leave: function(node, key, parentNode)  {
			// skip-values returned from `enter` should not come into `leave`
			test.notEqual(node, whenTraverse.SKIP);
			test.notEqual(node, whenTraverse.REMOVE);
			test.notEqual(node, tree.d);

			var elapsed = getElapsed();

			console.log('Left %s (key: %s) after %d ms', util.inspect(node), key, elapsed);

			// check timings

			var shouldElapse;

			if (typeof node === 'number') {
				shouldElapse = node * 100;
			} else
			if ('b1' in node) {
				shouldElapse = 300;
			} else
			if (node === tree) {
				shouldElapse = 400;
			}

			test.equal(Math.round(elapsed / 100) * 100, shouldElapse);

			if (node === 3) {
				return whenTraverse.REMOVE;
			}
		}
	}).then(function(newTree ) {
		// got resolved tree here (everything is resolved except `d` and descendants):

		// should be same object
		test.equal(newTree, tree);

		// should have non-skipped values resolved
		test.equal(newTree.a, 0);
		test.deepEqual(newTree.b, {
			b1: 2
			// b2: 3 [REMOVE]
		});
		test.equal(newTree.c, 4);

		// d.shouldNotGoHere should not be resolved as `d` was skipped (but it should exist as Promise)
		test.ok(newTree.d.shouldNotGoHere instanceof Promise);
	})}
);

exports['own visitor'] = whenTraverseTest(function(test, tree, getElapsed) 
	// can't use arrow syntax since access to bound `this` is needed
	{return whenTraverse(tree, function (node, key, parentNode) {
		console.log('Visited %s (key: %s) after %d ms', util.inspect(node), key, getElapsed());

		if (node === 3) {
			return whenTraverse.REMOVE;
		}

		return this.into(node);
	}).then(function(newTree ) {
		// got resolved tree here (everything is resolved except `d` and descendants):

		// should be same object
		test.equal(newTree, tree);

		// should have non-skipped values resolved
		test.equal(newTree.a, 0);
		test.deepEqual(newTree.b, {
			b1: 2
			// b2: 3 [REMOVE]
		});
		test.equal(newTree.c, 4);
		test.deepEqual(newTree.d, {
			shouldNotGoHere: 5
		});
	})}
);

exports['just waiting'] = whenTraverseTest(function(test, tree) 
	{return whenTraverse(tree).then(function(newTree ) {
		// got resolved tree here (everything is resolved except `d` and descendants):

		// should be same object
		test.equal(newTree, tree);

		test.deepEqual(newTree, {
			a: 0,
			b: {
				b1: 2,
				b2: 3
			},
			c: 4,
			d: {
				shouldNotGoHere: 5
			}
		});
	})}
);

exports['double-processing'] = whenTraverseTest(function(test, tree, getElapsed) 
	{return whenTraverse(tree, {
		enter: function(node, key, parentNode)  {
			if (typeof node === 'object' && 'shouldNotGoHere' in node) {
				return whenTraverse.SKIP;
			}
		}
	}).then(whenTraverse(tree, {
		enter: function(node, key, parentNode)  {
			var elapsed = getElapsed();

			console.log('Double-entered %s (key: %s) after %d ms', util.inspect(node), key, elapsed);

			// check timings

			var shouldElapse;

			if (typeof node === 'number') {
				shouldElapse = node * 100;
			} else
			if (node === tree || node === tree.d) {
				shouldElapse = 0;
			} else
			if ('b1' in node) {
				shouldElapse = 100;
			}

			test.equal(Math.round(elapsed / 100) * 100, shouldElapse);
		}
	}))}
);