Hey there! If you are reading this, you have the misfortune of having to read my godawful code. Congrats! I'll try to explain all of the larger pieces with this document.

The HackUtils: 
  This little file contains all of the functions neccesary to make this batcher tick. It includes:
   
  batchScanner: Pretty self explanatory. Scans all of the possible servers, pulls out the purchased servers and home server, and then sorts them on the basis of available ram. You might notice that each server object contains a property known as assignedRam. This is going to be used in the shotgun blaster, to make the overall implementation simpler. 
    
  batchServerFileCopier: Again, self explanatory. Copys the required scripts into all of the batchServers, as previously defined in the batchScanner. Scripts come from the deployer, to make it more dynamic. 
    
  bestTargetFinder: As the name says, it finds the best target. It uses the scanner function to create a list of all servers, and then filters out the purchased servers and the home server. From there, it determines the hacking level of each server, and runs calculations if the hacking level is less than half of the player level AND if the time to weaken this server is less than 15 minutes. I could explain the calculations themselves, but I hope that thye are easy enough to follow. 
    
  prepChecker: This simply returns the boolean value "true" if the target is prepped and the value "false" if it isn't.
    
  prep: A pretty beefy file. First, it determines how many threads are required to both weaken and grow the server to its respective extremes. Then, it runs through all of the batch servers to determine where to place them. You may notice that the grow can be seperated if there is space, in which case it chunks it. This can not be done with the Weaken, as that can effect the timings too much. 
    
  greedFinder: Brute forces the greed based on the smallest server. You may notice that the home requirements are wrapped in a max. This is because, early game. That would repeatedly destroy the greed and drop it to the min. This just ensures that if home is the lowest, it simply won't be used and not gum up the process.
    
  blastingTime: A confusing name, perhaps, but I thought it was funny. This is by far the weirdest function, so bear with my explanation. It determines the totalRam available through the batchServers, and then runs a algorithm with the jobs already prebuilt. It assigns jobs to every single server it can, repeatedly. If the batch ever fails, then it is not recorded and the batches are pushed out. This takes all sorts of information from the deployer script, so it looks pretty inscrutable from this angle. It makes more sense in context, however, I promise...

  The Deployer: 
    
  This is the big one. I'll list out the steps, to make it as obvious as possible what happens. First, it has constants(TYPES, SCRIPTS, COSTS) all of which are essential to these functions. Don't mess with them unless you want satan himself to smite the script. From there, it opens up a window(for all that juicy info) and disables all other logging(so said juicy info is not buried). It also checks what the port could be, which is actually pretty useful. Now, for the while true loop.
      
  First, it uses the hackUtils previously described, which due their jobs. Then, it throws together a object named targetInfo based on what the best target is. From there, it determines what the best greed is, copies the files, and preps the target if it needs to be prepped. Then, it gets the batches from the blastingTime function, and begins them all using the times, threads, delays, and target that are taken from the target. It returns how long the batch is expected to take to the window, and restarts the process once it detects that the last weaken has finished(more one that later).

  tWeaken2: This is the only one I feel an obligation to metion, as all the others are very self explanatory. In this, it performs the simple duties that are required, and then writes to the port (determined in the deployer) that it is done. The deployer notes this and waits until all weakens have reported back. 

That should be everything. If I forgot something, then I forgot something. This was a doozy to write, so I'm thankful it's over. There are stil couple of bugs to work out(continually needs to reprep the server, implying that some timings are screwed) but other than that, everything works as intended!
