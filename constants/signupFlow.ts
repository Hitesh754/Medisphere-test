let signupCompleted = false;

export function isSignupCompleted() {
  return signupCompleted;
}

export function markSignupCompleted() {
  signupCompleted = true;
}
