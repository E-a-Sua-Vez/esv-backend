export const htmlTemplate = `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">

<head>
	<title></title>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0"><!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 0;
		}

		a[x-apple-data-detectors] {
			color: inherit !important;
			text-decoration: inherit !important;
		}

		#MessageViewBody a {
			color: inherit;
			text-decoration: none;
		}

		p {
			line-height: inherit
		}

		.desktop_hide,
		.desktop_hide table {
			mso-hide: all;
			display: none;
			max-height: 0px;
			overflow: hidden;
		}

		.image_block img+div {
			display: none;
		}

		@media (max-width:620px) {

			.row-12 .column-1 .block-1.image_block img,
			.row-13 .column-1 .block-2.image_block img,
			.row-15 .column-3 .block-1.social_block .alignment table,
			.social_block.desktop_hide .social-table {
				display: inline-block !important;
			}

			.image_block img.fullWidth {
				max-width: 100% !important;
			}

			.mobile_hide {
				display: none;
			}

			.row-content {
				width: 100% !important;
			}

			.stack .column {
				width: 100%;
				display: block;
			}

			.mobile_hide {
				min-height: 0;
				max-height: 0;
				max-width: 0;
				overflow: hidden;
				font-size: 0px;
			}

			.desktop_hide,
			.desktop_hide table {
				display: table !important;
				max-height: none !important;
			}

			.row-12 .column-2 .block-1.spacer_block,
			.row-15 .column-1 .block-1.spacer_block,
			.row-15 .column-1 .block-3.spacer_block,
			.row-2 .column-1 .block-1.spacer_block,
			.row-2 .column-3 .block-1.spacer_block {
				height: 1px !important;
			}

			.row-3 .column-2 .block-1.spacer_block {
				height: 11px !important;
			}

			.row-4 .column-1 .block-1.heading_block h1 {
				font-size: 18px !important;
			}

			.row-11 .column-1 .block-1.heading_block h1,
			.row-4 .column-1 .block-2.heading_block h1 {
				font-size: 12px !important;
			}

			.row-3 .column-2 .block-3.heading_block td.pad {
				padding: 0 10px 0 0 !important;
			}

			.row-3 .column-2 .block-3.heading_block h1,
			.row-4 .column-1 .block-3.heading_block h1 {
				font-size: 14px !important;
			}

			.row-3 .column-2 .block-2.heading_block h1 {
				font-size: 21px !important;
			}

			.row-6 .column-1 .block-1.heading_block h1,
			.row-8 .column-2 .block-1.heading_block h1 {
				font-size: 13px !important;
			}

			.row-8 .column-2 .block-2.image_block td.pad,
			.row-8 .column-2 .block-3.paragraph_block td.pad {
				padding: 5px 15px !important;
			}

			.row-6 .column-1 .block-2.heading_block td.pad {
				padding: 0 20px !important;
			}

			.row-6 .column-1 .block-2.heading_block h1 {
				font-size: 16px !important;
			}

			.row-12 .column-1,
			.row-12 .column-2 .block-2.heading_block td.pad,
			.row-15 .column-3 .block-1.social_block td.pad,
			.row-8 .column-1 .block-1.image_block td.pad {
				padding: 0 !important;
			}

			.row-10 .column-1 .block-1.button_block td.pad,
			.row-12 .column-2 .block-3.button_block td.pad {
				padding: 0 15px 5px !important;
			}

			.row-10 .column-1 .block-1.button_block a,
			.row-10 .column-1 .block-1.button_block div,
			.row-10 .column-1 .block-1.button_block span {
				font-size: 18px !important;
				line-height: 18px !important;
			}

			.row-12 .column-1 .block-1.image_block .alignment,
			.row-13 .column-1 .block-1.heading_block h1,
			.row-13 .column-1 .block-2.image_block .alignment,
			.row-15 .column-2 .block-1.heading_block h1,
			.row-15 .column-2 .block-2.heading_block h1,
			.row-15 .column-3 .block-1.social_block .alignment {
				text-align: center !important;
			}

			.row-11 .column-1 .block-1.heading_block td.pad {
				padding: 10px 30px !important;
			}

			.row-13 .column-2 .block-1.spacer_block,
			.row-13 .column-2 .block-3.spacer_block {
				height: 5px !important;
			}

			.row-13 .column-2 .block-2.heading_block td.pad {
				padding: 10px 20px !important;
			}

			.row-13 .column-2 .block-2.heading_block h1 {
				font-size: 20px !important;
			}

			.row-6 .column-1 .block-1.heading_block td.pad {
				padding: 10px 20px 0 !important;
			}

			.row-12 .column-2 .block-2.heading_block h1 {
				text-align: center !important;
				font-size: 13px !important;
			}

			.row-12 .column-2 .block-3.button_block a,
			.row-12 .column-2 .block-3.button_block div,
			.row-12 .column-2 .block-3.button_block span {
				line-height: 18px !important;
			}

			.row-1 .column-1 {
				padding: 0 0 5px !important;
			}

			.row-12 .column-2 {
				padding: 0 0 10px !important;
			}

			.row-14 .column-1 {
				padding: 5px 0 0 !important;
			}
		}
	</style>
</head>

<body style="background-color: #fff; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
	<table class="nl-container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #fff; background-size: auto; background-image: none; background-position: top left; background-repeat: no-repeat;">
		<tbody>
			<tr>
				<td>
					<table class="row row-2" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-size: auto; margin-top:4rem">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-size: auto; border-radius: 0; color: #000; width: 600px; margin: 0 auto;" width="600">
										<tbody>
											<tr>
												<td class="column column-1" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<div class="spacer_block block-1" style="height:60px;line-height:60px;font-size:1px;">&#8202;</div>
												</td>
												<td class="column column-2" width="58.333333333333336%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center" style="line-height:10px"><a style="outline:none" tabindex="-1"><img src="{{logo}}" style="display: block; height: auto; border: 0; max-width: 244.99999999999997px; width: 100%;" width="244.99999999999997"></a></div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-3" width="16.666666666666668%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<div class="spacer_block block-1" style="height:60px;line-height:60px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<!--SALUDO-->
					<table class="row row-3" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-size: auto;">
						<tbody>
							<tr>
								<td>
									<table class="row-content" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-size: auto; color: #000; width: 600px; margin: 0 auto;" width="600">
										<tbody>
											<tr>
												<td class="column column-2" width="75%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<div class="spacer_block block-1" style="height:30px;line-height:30px;font-size:1px;">&#8202;</div>
													<table class="heading_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-right:10px;text-align:center;width:100%;">
																<h1 style="margin: 0; color: #000000; direction: ltr; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 32px; font-weight: 400; letter-spacing: -2px; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">
																	Hola, bienvenido a <strong>{{commerce}}</strong> 👋🏼</span>
																</h1>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<!--CONTENIDO 1-->
					<table class="row row-4" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000; width: 600px; margin: 0 auto;" width="600">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="heading_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-left:30px;padding-right:30px;padding-top:10px;text-align:center;width:100%;">
																<h1 style="margin: 0; color: #000000; direction: ltr; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 14px; font-weight: 400; letter-spacing: normal; line-height: 120%; text-align: center; margin-top: 0; margin-bottom: 0;">
																	<span class="tinyMce-placeholder">
																		<p style="font-size: 20px;">Presentamos nuestros términos y condiciones de servicio adjuntos a este correo electrónico.</p><br>
																		<p style="font-size: 15px;">⚠️ IMPORTANTE: Lea cuidadosamente. Te recordamos que al reservar o solicitar nuestros servicios declaras haber leído y aceptado íntegramente todas nuestras condiciones. Si tiene alguna pregunta, por favor contáctenos. </p>
																		<span style="font-size: 15px;"></span>
																	</span>
																</h1>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-13" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000; width: 600px; margin: 0 auto;" width="600">
										<tbody>
											<tr>
												<td class="column column-1" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="heading_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<h1 style="margin: 0; color: #000000; direction: ltr; font-family: Arial, Helvetica, sans-serif; font-size: 17px; font-weight: 400; letter-spacing: normal; line-height: 120%; text-align: left; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">Abraços,</span></h1>
															</td>
														</tr>
													</table>
													<table class="heading_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<h1 style="margin: 0; color: #000000; direction: ltr; font-family: Arial, Helvetica, sans-serif; font-size: 17px; font-weight: 400; letter-spacing: normal; line-height: 120%; text-align: left; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder"><strong>{{commerce}}</strong>.</span></h1>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-2" width="75%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<div class="spacer_block block-1 mobile_hide" style="height:30px;line-height:30px;font-size:1px;">&#8202;</div>
													<table class="heading_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">

															</td>
														</tr>
													</table>
													<div class="spacer_block block-3 mobile_hide" style="height:30px;line-height:30px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-14" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000; width: 600px; margin: 0 auto;" width="600">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
															<br>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-15" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000; background-image: url('https://4d90a9ef02.imgdist.com/public/users/Integrators/BeeProAgency/1060577_1045781/Disen%CC%83o%20Email%20%2813%29.png'); background-repeat: no-repeat; background-size: cover; width: 600px; margin: 0 auto;" width="600">
										<tbody>
											<tr>
												<td class="column column-2" width="50%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="heading_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-top:5px;text-align:center;width:100%;">
																<h1 style="margin: 0; margin-left:1rem; color: #ffffff; direction: ltr; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 400; letter-spacing: normal; line-height: 120%; text-align: left; margin-top: 0; margin-bottom: 0;"><span class="tinyMce-placeholder">Powered by</span></h1>
															</td>
														</tr>
													</table>
													<table class="heading_block block-2" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-bottom:5px;text-align:center;width:100%;">
																<h1 style="margin: 0; margin-left:1rem; color: #ffffff; direction: ltr; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 700; letter-spacing: normal; line-height: 120%; text-align: left; margin-top: 0; margin-bottom: 0;"><a href="https://www.estuturno.app" target="_blank" style="text-decoration: none; color: #ffffff;" rel="noopener">estuturno.app</a></h1>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-3" width="33.333333333333336%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-16" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-radius: 0; color: #000; width: 600px; margin: 0 auto;" width="600">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top; border-top: 0px; border-right: 0px; border-bottom: 0px; border-left: 0px;">
													<table class="paragraph_block block-1" width="100%" border="0" cellpadding="5" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#101112;direction:ltr;font-family:Arial, Helvetica, sans-serif;font-size:8px;font-weight:400;letter-spacing:0px;line-height:120%;text-align:center;mso-line-height-alt:9.6px;">
																	<p style="margin: 0;">Enviado por&nbsp;<strong>É a sua vez<br></strong><a href="mailto:hola@estuturno.app" target="_blank" rel="noopener" title="ola@estuturno.app" style="text-decoration: underline; color: #000000;">ola@estuturno.app</a>&nbsp;<br>Se você não deseja mais receber mensagens como esta, por favor nos avise.</p>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
		</tbody>
	</table><!-- End -->
</body>

</html>`;
