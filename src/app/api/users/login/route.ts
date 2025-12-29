import { connect } from "@/dbConfig/dbConfig";
import User, { IUser } from "@/models/userModels";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

connect();

export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const { email, password } = reqBody;
    console.log("reqbody",reqBody)

    // Find user by email
    const user: IUser | null = await User.findOne({ email });

    if (!user) {
      console.log("No user");
      return NextResponse.json({ error: "User does not exists." }, { status: 400 });
    }else{
      console.log(user);
    }

    // Use custom instance method to validate password
    const isValidPassword = await user.isPasswordCorrect(password);
    if (!user.isEmailVerified) {
      console.log("Email not verified");
    }
    if (!isValidPassword) {
      console.log("Invalid password");
      return NextResponse.json({ error: "Invalid Email or Password" }, { status: 400 });
    }

    console.log(user);

    const accessToken = await user.generateAccessToken();
    
    const response = NextResponse.json({
      message: "Login Successful.",
      success: true,
      data:user
    });

    console.log(response);

    response.cookies.set("accessToken",accessToken,{
      httpOnly:true,
    })

    return response;

  } 
  
  catch (error: any) {
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

/*
EXPLANATION:

1. Import IUser from userModels so TypeScript knows about custom user instance methods.
2. When you use User.findOne, annotate the return type as IUser (or IUser|null).
3. Now TypeScript allows you to call custom instance methods, like isPasswordCorrect,
   on your user document instance.
4. This approach maintains full type safety and prevents "property does not exist" errors
   when accessing schema methods from the model anywhere in your app.
*/
