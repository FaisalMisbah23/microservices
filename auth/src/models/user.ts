import mongoose from "mongoose";
import { Password } from "../services/password";

// An interface that describes the properties that are required to create a user 
interface userAttr {
    email: string,
    password: string
}

// An interface that describes the properties that a User Model has 
interface UserModel extends mongoose.Model<UserDoc> {
    build(attr: userAttr): UserDoc;
}

// An interface that describe the properties that a User Document has 
interface UserDoc extends mongoose.Document {
    email: string
    password: string
    // createdAt: string
    // updatedAt: string
}

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
}, {
    toJSON: {
        transform(doc, ret) {
            const transformed = { ...ret } as Record<string, any>;

            transformed.id = transformed._id?.toString();
            delete transformed._id;
            delete transformed.password;
            delete transformed.__v;

            return transformed;
        }
    }
})

userSchema.pre('save', async function(){
    if(this.isModified('password')){
        const hashed = await Password.toHash(this.get('password'))
        this.set('password',hashed)
    }
})

userSchema.statics.build = (attr: userAttr) => {
    return new User(attr);
}

const User = mongoose.model<UserDoc, UserModel>('User', userSchema);

export { User };

