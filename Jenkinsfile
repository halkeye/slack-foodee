node {
    def app
    stage('Preparation') { // for display purposes
        checkout scm
    }
    stage('Build') {
        wrap([$class: 'AnsiColorBuildWrapper']) {
            app = docker.build("halkeye/slack-foodee:${BUILD_NUMBER}")
            app.tag("latest")
        }
    }
    stage('Upload') {
       withDockerRegistry([credentialsId: 'dockerhub-halkeye']) {
           app.push("${BUILD_NUMBER}")
           app.push('latest')
       }
    }
}
