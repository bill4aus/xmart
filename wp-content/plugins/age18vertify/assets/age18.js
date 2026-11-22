/**
 * Age 18 Verify — front-end only 18+ overlay
 *
 * The overlay is created entirely by this script, so the page HTML stays clean
 * and crawlers that don't execute JavaScript see the original content.
 */

(function () {
	'use strict';

	// ===== Edit the copy here =====
	var TEXT = {
		badge: '18+',
		title: 'Are you 18 or older?',
		desc: 'This site contains content intended for adults only. Please confirm that you are at least 18 years old.',
		confirm: 'Yes, I am 18 or older',
		decline: 'No, I am under 18',
		denied: 'Sorry, you must be at least 18 years old to view this site.'
	};

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
