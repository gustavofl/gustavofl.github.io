class ARButton {

	static createButton(renderer, sessionInit = {}) {

		const button = document.createElement('button');

		function showStartAR( /*device*/) {

			if (sessionInit.domOverlay === undefined) {

				const overlay = document.createElement('div');
				overlay.style.display = 'none';
				overlay.id = 'div_overlay';
				document.body.appendChild(overlay);

				const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				svg.setAttribute('width', 38);
				svg.setAttribute('height', 38);
				svg.style.position = 'absolute';
				svg.style.right = '20px';
				svg.style.top = '20px';
				svg.addEventListener('click', function () {
					currentSession.end();
				});
				overlay.appendChild(svg);

				const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path.setAttribute('d', 'M 12,12 L 28,28 M 28,12 12,28');
				path.setAttribute('stroke', '#fff');
				path.setAttribute('stroke-width', 2);
				svg.appendChild(path);

				// Criar o elemento div com o id "tracking-prompt"
				const trackingPromptDiv = document.createElement('div');
				trackingPromptDiv.id = 'tracking-prompt';
				trackingPromptDiv.style.position = 'absolute';
				trackingPromptDiv.style.left = '50%';
				trackingPromptDiv.style.bottom = '175px';
				trackingPromptDiv.style.animation = 'elongate 2s infinite ease-in-out alternate';
				trackingPromptDiv.style.display = 'none'; // Inicialmente escondido

				// Criar o elemento img
				const handImage = document.createElement('img');
				handImage.src = 'PNG/hand.png';
				handImage.style.animation = 'circle 4s linear infinite';

				// Adicionar a imagem ao div
				trackingPromptDiv.appendChild(handImage);

				// Adicionar o div ao body do documento (ou a outro elemento desejado)
				overlay.appendChild(trackingPromptDiv);

				// Criar o elemento div com o id "prompts-container"
				const promptsContainer = document.createElement('div');
				promptsContainer.id = 'prompts-container';
				promptsContainer.style.position = 'absolute';
				promptsContainer.style.left = '5%';
				promptsContainer.style.bottom = '40px';
				promptsContainer.style.width = '90%';
				promptsContainer.style.height = '11%';
				promptsContainer.style.display = 'flex';
				promptsContainer.style.flexDirection = 'column';
				promptsContainer.style.justifyContent = 'space-between'; // Distribuir o espaço verticalmente
				promptsContainer.style.display = 'block';

				// Criar o elemento div com o id "message-div"
				const messageDiv = document.createElement('div');
				messageDiv.id = 'message-div';
				messageDiv.style.width = '100%';
				messageDiv.style.height = '60%';
				messageDiv.style.backgroundColor = 'rgba(220, 220, 220, 0.5)';
				messageDiv.style.borderRadius = '5px';
				messageDiv.style.textAlign = 'center';
				messageDiv.style.color = '#000';
				messageDiv.style.fontSize = '5vw';
				messageDiv.textContent = '0';
				messageDiv.style.display = 'flex';
				messageDiv.style.alignItems = 'center';
				messageDiv.style.justifyContent = 'center';
				messageDiv.style.border = 'none';
				messageDiv.style.userSelect = 'none';
				messageDiv.style.webkitUserSelect = 'none'; // Safari/iOS

				// Adicionar o div ao container
				promptsContainer.appendChild(messageDiv);

				// Adicionar o container ao overlay
				overlay.appendChild(promptsContainer);

				if (sessionInit.optionalFeatures === undefined) {
					sessionInit.optionalFeatures = [];
				}

				sessionInit.optionalFeatures.push('dom-overlay');
				sessionInit.domOverlay = { root: overlay };

			}

			//

			let currentSession = null;

			async function onSessionStarted(session) {
				session.addEventListener('end', onSessionEnded);
				renderer.xr.setReferenceSpaceType('local');
				await renderer.xr.setSession(session);
				sessionInit.domOverlay.root.style.display = '';
				currentSession = session;
			}

			function onSessionEnded( /*event*/) {
				currentSession.removeEventListener('end', onSessionEnded);

				button.textContent = 'Ver no seu espaço';
				sessionInit.domOverlay.root.style.display = 'none';

				currentSession = null;
			}

			button.style.display = '';

			button.style.cursor = 'pointer';
			button.style.width = 'auto';
			button.style.left = '50%';
			button.style.transform = 'translateX(-50%)';
			button.style.maxWidth = '450px';

			button.textContent = 'Ver no seu espaço';

			button.onclick = function () {

				if (currentSession === null) {
					navigator.xr.requestSession('immersive-ar', sessionInit).then(onSessionStarted);
				} else {
					currentSession.end();
					if (navigator.xr.offerSession !== undefined) {
						navigator.xr.offerSession('immersive-ar', sessionInit)
							.then(onSessionStarted)
							.catch((err) => {
								console.warn(err);
							});
					}
				}
			};

			if (navigator.xr.offerSession !== undefined) {
				navigator.xr.offerSession('immersive-ar', sessionInit)
					.then(onSessionStarted)
					.catch((err) => {
						console.warn(err);
					});
			}
		}

		function stylizeElement(element) {
			element.style.position = 'absolute';
			element.style.bottom = '140px';
			element.style.padding = '12px 24px';
			element.style.border = '0.1em solid #000';
			element.style.borderColor = 'rgba(196, 196, 196, 0.67)';
			element.style.borderRadius = '1em';
			element.style.background = 'rgb(255, 255, 255)';
			element.style.color = 'rgba(13, 161, 0, 0.74)';
			element.style.font = 'normal 2.5em sans-serif';
			element.style.textAlign = 'center';
			element.style.opacity = '1';
			element.style.outline = 'none';
			element.style.zIndex = '999';
		}

		if ('xr' in navigator) {
			button.id = 'ARButton';
			button.style.display = 'none';

			stylizeElement(button);

			navigator.xr.isSessionSupported('immersive-ar').then(function (supported) {

				supported ? showStartAR() : console.warn('AR not supported');

			}).catch(console.warn('showARNotAllowed'));

			return button;
		}

	}

}

export { ARButton };
