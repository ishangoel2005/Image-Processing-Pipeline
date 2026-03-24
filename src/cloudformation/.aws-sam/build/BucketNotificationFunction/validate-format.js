class NotSupportedImageTypeError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotSupportedImageTypeError";
    }
}

exports.handler = async (event) => {
    console.log("validate-format input:", JSON.stringify(event));
    const format = event.metadata.format.toLowerCase();
    
    // allow image/jpeg, image/jpg, image/png
    if (format === 'image/jpeg' || format === 'image/jpg' || format === 'image/png') {
        return event; // pass the state forward
    } else {
        throw new NotSupportedImageTypeError(`Image format ${format} is not supported. Please upload JPG or PNG.`);
    }
};
