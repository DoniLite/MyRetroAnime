/**
 * MAL's medium poster (225×318): the same URL without the "l" after the image number. The large one (~425×600) weighs
 * three times as much and is never shown that big here; on slow connections that adds up fast.
 */
export const mediumPoster = (url: string) =>
	url.replace(/(\d)l\.(jpg|webp)$/, "$1.$2");
