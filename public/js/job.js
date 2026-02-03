// Job page client-side behaviors
// - Disable page scrolling when content fits viewport
(function(){
	function adjustBodyScroll(){
		try {
			if (document.body.scrollHeight <= window.innerHeight) {
				document.documentElement.style.overflow = 'hidden';
			} else {
				document.documentElement.style.overflow = 'auto';
			}
		} catch (e) {
			console.warn('adjustBodyScroll failed', e);
		}
	}

	window.addEventListener('load', adjustBodyScroll);
	window.addEventListener('resize', adjustBodyScroll);
})();