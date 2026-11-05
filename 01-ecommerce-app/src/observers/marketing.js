// Observer: sends a welcome email when a payment happens
export default class Marketing {
  // called by the subject on every payment
  update({id, userName}){

    /*
      it's important to remember that this function is responsible for handling its own errors/exceptions

      our subject won't have any await here (or something that might block execution)
      our subject is the engine that sends data to all observers
    */

      console.log(`[${id}] [marketing] will send a welcome email to [${userName}]`)
 
  }
}
