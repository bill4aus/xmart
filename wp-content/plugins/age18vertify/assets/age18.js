/**
 * Age 18 Verify — front-end only 18+ overlay
 *
 * The overlay is created entirely by this script, so the page HTML stays clean
 * and crawlers that don't execute JavaScript see the original content.
 *
 * Copy and colors come from Settings → Age 18 Verify. The defaults below are
 * only used when a field was left empty in the admin.
 */

(function () {
	'use strict';

	// Settings passed in by WordPress as window.age18vertifyConfig.
	var CONFIG = window.age18vertifyConfig || {};

	// Use the saved value when it is a non-empty string, otherwise the default.
	function setting(key, fallback) {
		var value = CONFIG[key];

		return ('string' === typeof value && '' !== value.trim()) ? value : fallback;
	}

	// Escape text before it is inserted as HTML.
	function escapeHtml(value) {
		return String(value).replace(/[&<>"']/g, function (char) {
			return {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;'
			}[char];
		});
	}

	// Pick black or white text for a given hex background.
	function readableText(hex) {
		var h = String(hex || '').replace('#', '');

		if (3 === h.length) {
			h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
		}
		if (6 !== h.length) {
			return '#ffffff';
		}

		var r = parseInt(h.substr(0, 2), 16);
		var g = parseInt(h.substr(2, 2), 16);
		var b = parseInt(h.substr(4, 2), 16);

		if (isNaN(r) || isNaN(g) || isNaN(b)) {
			return '#ffffff';
		}

		return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111827' : '#ffffff';
	}

	var TEXT = {
		badge: escapeHtml(setting('badge', '18+')),
		title: escapeHtml(setting('title', 'Are you 18 or older?')),
		desc: escapeHtml(setting('desc', 'This site contains content intended for adults only. Please confirm that you are at least 18 years old.')),
		confirm: escapeHtml(setting('confirm', 'Yes, I am 18 or older')),
		decline: escapeHtml(setting('decline', 'No, I am under 18')),
		denied: escapeHtml(setting('denied', 'Sorry, you must be at least 18 years old to view this site.'))
	};

	// Empty color = the stylesheet's theme color. Empty text color = automatic.
	var COLOR = setting('color', '');
	var COLOR_TEXT = setting('colorText', '');

	// Storage key. Change it to make returning visitors see the gate once more.
	var KEY = 'age18_verified';

	// Already confirmed: do nothing at all.
	try {
		if (localStorage.getItem(KEY) === '1') {
			return;
		}
	} catch (e) {}

	// Skip for search engines that render JavaScript.
	if (/googlebot|bingbot|baiduspider|yandex|spider|crawler|slurp|headlesschrome/i.test(navigator.userAgent)) {
		return;
	}

	if (!document.body) {
		return;
	}

	var overlay = document.createElement('div');
	overlay.className = 'age18-overlay';
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', TEXT.title);
	overlay.innerHTML =
		'<div class="age18-card" tabindex="-1">' +
			'<span class="age18-badge">' + TEXT.badge + '</span>' +
			'<h2 class="age18-title">' + TEXT.title + '</h2>' +
			'<p class="age18-text">' + TEXT.desc + '</p>' +
			'<button type="button" class="age18-btn age18-btn--primary">' + TEXT.confirm + '</button>' +
			'<button type="button" class="age18-btn age18-btn--ghost">' + TEXT.decline + '</button>' +
			'<p class="age18-denied" hidden>' + TEXT.denied + '</p>' +
		'</div>';

	document.body.appendChild(overlay);

	// Inline custom properties win over the stylesheet, but a theme rule with
	// !important can still override them.
	if (COLOR) {
		overlay.style.setProperty('--age18-primary', COLOR);
		overlay.style.setProperty('--age18-primary-text', COLOR_TEXT || readableText(COLOR));
	} else if (COLOR_TEXT) {
		overlay.style.setProperty('--age18-primary-text', COLOR_TEXT);
	}

	document.documentElement.classList.add('age18-lock');

	var card = overlay.querySelector('.age18-card');
	var confirmBtn = overlay.querySelector('.age18-btn--primary');
	var declineBtn = overlay.querySelector('.age18-btn--ghost');
	var deniedText = overlay.querySelector('.age18-denied');

	card.focus();

	// Confirm: remember the choice and remove the overlay.
	confirmBtn.addEventListener('click', function () {
		try {
			localStorage.setItem(KEY, '1');
		} catch (e) {}

		document.documentElement.classList.remove('age18-lock');
		overlay.parentNode.removeChild(overlay);
	});

	// Under 18: keep the overlay, just replace the buttons with a notice.
	declineBtn.addEventListener('click', function () {
		confirmBtn.hidden = true;
		declineBtn.hidden = true;
		deniedText.hidden = false;
	});
})();
